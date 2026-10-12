import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

import {
  BrokerHttpError,
  type BrokerTask,
  type ExecTaskResult,
  type StartTaskRequest,
} from "./contract";
import { createBroker, type Broker, type BrokerOptions } from "./broker";
import { createServer } from "./server";
import type {
  BrokerTaskRecord,
  CommandRecord,
  StateStore,
  Stored,
} from "./store";
import type { CreateInstanceInput, GceApi } from "./gce";
import { workerStartupScript } from "./worker";

class FakeGce implements GceApi {
  instances = new Map<string, { status: string }>();
  created: CreateInstanceInput[] = [];
  deleted: string[] = [];

  async createInstance(input: CreateInstanceInput): Promise<void> {
    this.created.push(input);
    if (this.instances.has(input.name)) {
      throw new BrokerHttpError(
        409,
        "already_exists",
        `Instance ${input.name} already exists.`,
      );
    }
    this.instances.set(input.name, { status: "PROVISIONING" });
  }

  async getInstance(name: string): Promise<{ status: string } | null> {
    return this.instances.get(name) ?? null;
  }

  async deleteInstance(name: string): Promise<void> {
    this.deleted.push(name);
    this.instances.delete(name);
  }

  setStatus(name: string, status: string): void {
    const instance = this.instances.get(name);
    if (instance) instance.status = status;
  }
}

class FakeStore implements StateStore {
  tasks = new Map<string, BrokerTaskRecord>();
  commands = new Map<string, CommandRecord>();
  generations = new Map<string, number>();

  async getTask(taskId: string): Promise<BrokerTaskRecord | null> {
    return this.tasks.get(taskId) ?? null;
  }

  async putTask(record: BrokerTaskRecord): Promise<void> {
    this.tasks.set(record.id, { ...record });
  }

  async listTasks(): Promise<BrokerTaskRecord[]> {
    return [...this.tasks.values()].map((record) => ({ ...record }));
  }

  async getCommand(
    taskId: string,
    commandId: string,
  ): Promise<Stored<CommandRecord> | null> {
    const key = `${taskId}/${commandId}`;
    const value = this.commands.get(key);
    if (!value) return null;
    return { value: { ...value }, generation: this.generations.get(key) ?? 1 };
  }

  async putCommand(
    record: CommandRecord,
    opts?: { ifGenerationMatch?: number },
  ): Promise<boolean> {
    const key = `${record.taskId}/${record.commandId}`;
    const generation = this.generations.get(key) ?? 0;
    if (
      opts?.ifGenerationMatch !== undefined &&
      opts.ifGenerationMatch !== generation
    ) {
      return false;
    }
    this.commands.set(key, { ...record });
    this.generations.set(key, generation + 1);
    return true;
  }

  async listCommands(taskId: string): Promise<Stored<CommandRecord>[]> {
    const results: Stored<CommandRecord>[] = [];
    for (const [key, value] of this.commands) {
      if (!key.startsWith(`${taskId}/`)) continue;
      results.push({
        value: { ...value },
        generation: this.generations.get(key) ?? 1,
      });
    }
    return results;
  }
}

function makeBroker(overrides: Partial<BrokerOptions> = {}) {
  const gce = new FakeGce();
  const store = new FakeStore();
  const broker = createBroker({
    gce,
    store,
    brokerUrl: "https://broker.example",
    pollIntervalMs: 10,
    longPollHoldMs: 100,
    execGraceSeconds: 1,
    ...overrides,
  });
  return { broker, gce, store };
}

function baseRequest(
  overrides: Partial<StartTaskRequest> = {},
): StartTaskRequest {
  return {
    apiVersion: "v1",
    profile: "linux-dev",
    repository: "vargasjr-dev/vargasjr.dev",
    baseRef: "main",
    branch: "qa/demo",
    idempotencyKey: "qa-demo-1",
    ...overrides,
  };
}

async function startServer(broker: Broker) {
  const server = createServer({ broker, brokerToken: "test-broker-token" });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const close = async (): Promise<void> => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    server.closeAllConnections();
  };
  return { base: `http://127.0.0.1:${address.port}`, close };
}

async function post(base: string, path: string, body: unknown, token?: string) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function startTask(
  base: string,
  request = baseRequest(),
): Promise<BrokerTask> {
  const response = await post(base, "/v1/tasks", request, "test-broker-token");
  assert.equal(response.status, 200);
  return (await response.json()) as BrokerTask;
}

test("healthz is open to unauthenticated callers", async () => {
  const { broker } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const response = await fetch(`${base}/v1/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, apiVersion: "v1" });
  } finally {
    await close();
  }
});

test("client plane rejects missing and wrong bearer tokens", async () => {
  const { broker } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const noAuth = await fetch(`${base}/v1/tasks`, { method: "POST" });
    assert.equal(noAuth.status, 401);
    const body = (await noAuth.json()) as {
      apiVersion: string;
      error: { code: string };
    };
    assert.deepEqual(Object.keys(body).sort(), ["apiVersion", "error"]);
    assert.equal(body.error.code, "unauthorized");

    const wrongAuth = await post(
      base,
      "/v1/tasks",
      baseRequest(),
      "wrong-token",
    );
    assert.equal(wrongAuth.status, 401);
  } finally {
    await close();
  }
});

test("start provisions a GCE worker and returns the queued task", async () => {
  const { broker, gce } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const task = await startTask(base);
    assert.deepEqual(Object.keys(task).sort(), [
      "apiVersion",
      "createdAt",
      "expiresAt",
      "id",
      "request",
      "status",
      "updatedAt",
    ]);
    assert.equal(task.apiVersion, "v1");
    assert.equal(task.status, "provisioning");
    assert.match(task.id, /^task-[a-z0-9-]{6,64}$/);

    assert.equal(gce.created.length, 1);
    const created = gce.created[0];
    assert.equal(created.name, task.id);
    assert.equal(created.machineType, "t2a-standard-2");
    assert.match(created.sourceImage, /debian-12-arm64$/);
    assert.equal(created.labels["managed-by"], "compute-broker");
    assert.equal(created.labels.profile, "linux-dev");
    // Repository, baseRef, and branch are shell-quoted into the script;
    // no clone token is embedded when none is configured.
    assert.match(
      created.startupScript,
      /github\.com\/vargasjr-dev\/vargasjr\.dev\.git'/,
    );
    assert.match(created.startupScript, /'qa\/demo'/);
    assert.match(created.startupScript, /'main'/);
    assert.doesNotMatch(created.startupScript, /x-access-token/);
    assert.match(created.startupScript, /systemd-run --on-active=14400/);
  } finally {
    await close();
  }
});

test("start is idempotent for the same idempotency key", async () => {
  const { broker, gce } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const first = await startTask(base);
    const second = await startTask(base);
    assert.equal(first.id, second.id);
    assert.equal(gce.created.length, 1);
  } finally {
    await close();
  }
});

test("unknown profiles and missing backends are rejected", async () => {
  const { broker } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const unknown = await post(
      base,
      "/v1/tasks",
      baseRequest({ profile: "nope" }),
      "test-broker-token",
    );
    assert.equal(unknown.status, 400);
    assert.equal(
      ((await unknown.json()) as { error: { code: string } }).error.code,
      "unknown_profile",
    );

    const noReason = await post(
      base,
      "/v1/tasks",
      baseRequest({ profile: "macos-qa" }),
      "test-broker-token",
    );
    assert.equal(noReason.status, 400);
    assert.equal(
      ((await noReason.json()) as { error: { code: string } }).error.code,
      "reason_required",
    );

    const gated = await post(
      base,
      "/v1/tasks",
      baseRequest({ profile: "macos-qa", reason: "apple-platform" }),
      "test-broker-token",
    );
    assert.equal(gated.status, 400);
    assert.equal(
      ((await gated.json()) as { error: { code: string } }).error.code,
      "profile_backend_unavailable",
    );
  } finally {
    await close();
  }
});

test("enforces the profile concurrency limit", async () => {
  const { broker } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    for (let index = 0; index < 3; index += 1) {
      await startTask(base, baseRequest({ idempotencyKey: `key-${index}` }));
    }
    const fourth = await post(
      base,
      "/v1/tasks",
      baseRequest({ idempotencyKey: "key-3" }),
      "test-broker-token",
    );
    assert.equal(fourth.status, 429);
    assert.equal(
      ((await fourth.json()) as { error: { code: string } }).error.code,
      "limit_reached",
    );
  } finally {
    await close();
  }
});

test("exec claims work through the agent plane and returns results", async () => {
  const { broker, gce, store } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const task = await startTask(base);
    gce.setStatus(task.id, "RUNNING");
    const record = await store.getTask(task.id);
    assert.ok(record);
    const agentToken = record.agentToken;

    const execPromise = post(
      base,
      `/v1/tasks/${task.id}/exec`,
      { apiVersion: "v1", argv: ["npm", "test"] },
      "test-broker-token",
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    const workResponse = await fetch(
      `${base}/v1/agent/work?taskId=${task.id}`,
      {
        headers: { authorization: `Bearer ${agentToken}` },
      },
    );
    assert.equal(workResponse.status, 200);
    const work = (await workResponse.json()) as {
      commandId: string;
      argv: string[];
      timeoutSeconds: number;
    };
    assert.deepEqual(work.argv, ["npm", "test"]);
    assert.equal(work.timeoutSeconds, 300);

    const resultResponse = await fetch(`${base}/v1/agent/result`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        apiVersion: "v1",
        taskId: task.id,
        commandId: work.commandId,
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      }),
    });
    assert.equal(resultResponse.status, 200);

    const execResponse = await execPromise;
    assert.equal(execResponse.status, 200);
    const result = (await execResponse.json()) as ExecTaskResult;
    assert.deepEqual(Object.keys(result).sort(), [
      "apiVersion",
      "commandId",
      "exitCode",
      "finishedAt",
      "startedAt",
      "stderr",
      "stdout",
      "taskId",
    ]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "ok");
    assert.equal(result.commandId, work.commandId);

    // The claim is exclusive: a follow-up poll holds, then answers empty.
    const empty = await fetch(`${base}/v1/agent/work?taskId=${task.id}`, {
      headers: { authorization: `Bearer ${agentToken}` },
    });
    assert.equal(empty.status, 204);
  } finally {
    await close();
  }
});

test("exec times out with exitCode -1 when the agent never claims", async () => {
  const { broker, gce } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const task = await startTask(base);
    gce.setStatus(task.id, "RUNNING");

    const response = await post(
      base,
      `/v1/tasks/${task.id}/exec`,
      { apiVersion: "v1", argv: ["sleep", "1000"], timeoutSeconds: 1 },
      "test-broker-token",
    );
    assert.equal(response.status, 200);
    const result = (await response.json()) as ExecTaskResult;
    assert.equal(result.exitCode, -1);
    assert.match(result.stderr, /timed out after 1s/);
  } finally {
    await close();
  }
});

test("agent endpoints reject foreign tokens", async () => {
  const { broker, gce } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const task = await startTask(base);
    gce.setStatus(task.id, "RUNNING");

    const work = await fetch(`${base}/v1/agent/work?taskId=${task.id}`, {
      headers: { authorization: "Bearer forged-token" },
    });
    assert.equal(work.status, 403);
    assert.equal(
      ((await work.json()) as { error: { code: string } }).error.code,
      "agent_forbidden",
    );

    const result = await post(
      base,
      "/v1/agent/result",
      {
        apiVersion: "v1",
        taskId: task.id,
        commandId: "nope",
        exitCode: 0,
        stdout: "",
        stderr: "",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
      "forged-token",
    );
    assert.equal(result.status, 403);
  } finally {
    await close();
  }
});

test("finish tears down the instance and is idempotent", async () => {
  const { broker, gce } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const task = await startTask(base);
    const response = await post(
      base,
      `/v1/tasks/${task.id}/finish`,
      { apiVersion: "v1", outcome: "completed" },
      "test-broker-token",
    );
    assert.equal(response.status, 200);
    const finished = (await response.json()) as BrokerTask;
    assert.equal(finished.status, "finished");
    assert.ok(gce.deleted.includes(task.id));
    assert.equal(gce.instances.size, 0);

    const again = await post(
      base,
      `/v1/tasks/${task.id}/finish`,
      { apiVersion: "v1", outcome: "completed" },
      "test-broker-token",
    );
    assert.equal(again.status, 200);
    assert.equal(gce.deleted.length, 1);

    const lateExec = await post(
      base,
      `/v1/tasks/${task.id}/exec`,
      { apiVersion: "v1", argv: ["ls"] },
      "test-broker-token",
    );
    assert.equal(lateExec.status, 409);
    assert.equal(
      ((await lateExec.json()) as { error: { code: string } }).error.code,
      "task_not_active",
    );
  } finally {
    await close();
  }
});

test("status maps instance lifecycle onto task statuses", async () => {
  const { broker, gce, store } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const task = await startTask(base);

    const statusResponse = await fetch(`${base}/v1/tasks/${task.id}`, {
      headers: { authorization: "Bearer test-broker-token" },
    });
    assert.equal(statusResponse.status, 200);
    assert.equal(
      ((await statusResponse.json()) as BrokerTask).status,
      "provisioning",
    );

    gce.setStatus(task.id, "RUNNING");
    const runningBeforeHeartbeat = await fetch(`${base}/v1/tasks/${task.id}`, {
      headers: { authorization: "Bearer test-broker-token" },
    });
    assert.equal(
      ((await runningBeforeHeartbeat.json()) as BrokerTask).status,
      "provisioning",
    );

    const record = await store.getTask(task.id);
    assert.ok(record);
    record.lastSeenAt = new Date().toISOString();
    await store.putTask(record);
    const running = await fetch(`${base}/v1/tasks/${task.id}`, {
      headers: { authorization: "Bearer test-broker-token" },
    });
    assert.equal(((await running.json()) as BrokerTask).status, "running");

    gce.setStatus(task.id, "TERMINATED");
    const terminated = await fetch(`${base}/v1/tasks/${task.id}`, {
      headers: { authorization: "Bearer test-broker-token" },
    });
    assert.equal(((await terminated.json()) as BrokerTask).status, "failed");

    // Terminal states are sticky: expiry is judged when the instance is
    // first observed TERMINATED, on a task with no prior terminal mark.
    const earlyExpired = await startTask(
      base,
      baseRequest({ idempotencyKey: "ttl-1" }),
    );
    const ttlRecord = await store.getTask(earlyExpired.id);
    assert.ok(ttlRecord);
    ttlRecord.expiresAt = new Date(Date.now() - 1000).toISOString();
    await store.putTask(ttlRecord);
    gce.setStatus(earlyExpired.id, "TERMINATED");
    const expired = await fetch(`${base}/v1/tasks/${earlyExpired.id}`, {
      headers: { authorization: "Bearer test-broker-token" },
    });
    assert.equal(((await expired.json()) as BrokerTask).status, "expired");
  } finally {
    await close();
  }
});

test("sweep reaps hard-expired and idle-expired workers", async () => {
  const { broker, gce, store } = makeBroker();
  const hardTask = await broker.start(
    baseRequest({ idempotencyKey: "hard-1" }),
  );
  const hardRecord = await store.getTask(hardTask.id);
  assert.ok(hardRecord);
  hardRecord.expiresAt = new Date(Date.now() - 1000).toISOString();
  await store.putTask(hardRecord);

  const idleTask = await broker.start(
    baseRequest({ idempotencyKey: "idle-1" }),
  );
  gce.setStatus(idleTask.id, "RUNNING");
  const idleRecord = await store.getTask(idleTask.id);
  assert.ok(idleRecord);
  idleRecord.lastSeenAt = new Date(Date.now() - 21 * 60_000).toISOString();
  await store.putTask(idleRecord);

  await broker.sweep();

  assert.equal((await store.getTask(hardTask.id))?.status, "expired");
  assert.ok(gce.deleted.includes(hardTask.id));
  assert.equal((await store.getTask(idleTask.id))?.status, "expired");
  assert.ok(gce.deleted.includes(idleTask.id));
});

test("malformed bodies are rejected with the broker error shape", async () => {
  const { broker } = makeBroker();
  const { base, close } = await startServer(broker);
  try {
    const badVersion = await post(
      base,
      "/v1/tasks",
      { apiVersion: "v2" },
      "test-broker-token",
    );
    assert.equal(badVersion.status, 400);
    const body = (await badVersion.json()) as {
      apiVersion: string;
      error: { code: string };
    };
    assert.equal(body.error.code, "invalid_request");

    const notJson = await fetch(`${base}/v1/tasks`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-broker-token",
        "content-type": "application/json",
      },
      body: "{not json",
    });
    assert.equal(notJson.status, 400);
    assert.equal(
      ((await notJson.json()) as { error: { code: string } }).error.code,
      "invalid_json",
    );

    const unknownTask = await fetch(`${base}/v1/tasks/task-doesnotexist99`, {
      headers: { authorization: "Bearer test-broker-token" },
    });
    assert.equal(unknownTask.status, 404);
    assert.equal(
      ((await unknownTask.json()) as { error: { code: string } }).error.code,
      "task_not_found",
    );
  } finally {
    await close();
  }
});

test("worker startup script quotes refs and carries the clone token", () => {
  const tokenized = workerStartupScript({
    brokerUrl: "https://broker.example",
    taskId: "task-abc123def456",
    agentToken: "agent-secret",
    repository: "vargasjr-dev/vargasjr.dev",
    baseRef: "main",
    branch: "qa/demo v2",
    maxLifetimeMinutes: 240,
    githubToken: "gh_pat_test",
  });
  assert.match(
    tokenized,
    /https:\/\/x-access-token:gh_pat_test@github\.com\/vargasjr-dev\/vargasjr\.dev\.git/,
  );
  assert.match(tokenized, /'qa\/demo v2'/);
  assert.match(tokenized, /'task-abc123def456'/);
  assert.match(tokenized, /systemd-run --on-active=14400/);

  const anonymous = workerStartupScript({
    brokerUrl: "https://broker.example",
    taskId: "task-abc123def456",
    agentToken: "agent-secret",
    repository: "vargasjr-dev/vargasjr.dev",
    baseRef: "main",
    branch: "qa/demo",
    maxLifetimeMinutes: 240,
  });
  assert.match(
    anonymous,
    /git clone 'https:\/\/github\.com\/vargasjr-dev\/vargasjr\.dev\.git' repo/,
  );
  assert.doesNotMatch(anonymous, /x-access-token/);
});
