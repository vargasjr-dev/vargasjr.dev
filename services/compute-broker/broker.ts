import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  BROKER_API_VERSION,
  BrokerHttpError,
  type BrokerTask,
  type ExecTaskRequest,
  type ExecTaskResult,
  type FinishTaskRequest,
  type QueuedWork,
  type StartTaskRequest,
  type TaskStatus,
} from "./contract";
import { EXECUTION_PROFILES, INSTANCE_BACKENDS } from "./profiles";
import type { BrokerTaskRecord, CommandRecord, StateStore } from "./store";
import type { GceApi } from "./gce";
import { workerStartupScript } from "./worker";

// Broker core. Callers (the force plugin) never provide infrastructure or
// repository credentials — the broker owns provisioning, the clone token,
// and all TTL enforcement. GCE instances map 1:1 to tasks: the task id IS
// the instance name, state lives in the GCS-backed store, and a
// generation-precondition claim hands work to the worker agent.

const ACTIVE_STATUSES: ReadonlySet<TaskStatus> = new Set([
  "provisioning",
  "ready",
  "running",
]);
const TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set([
  "finished",
  "failed",
  "expired",
]);
const MAX_OUTPUT_CHARS = 1_000_000;

export interface BrokerOptions {
  gce: GceApi;
  store: StateStore;
  brokerUrl: string;
  githubToken?: string;
  now?: () => Date;
  randomToken?: () => string;
  pollIntervalMs?: number;
  longPollHoldMs?: number;
  execGraceSeconds?: number;
  maxExecTimeoutSeconds?: number;
}

export interface AgentResultPayload {
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
}

export interface Broker {
  start(request: StartTaskRequest): Promise<BrokerTask>;
  status(taskId: string): Promise<BrokerTask>;
  exec(taskId: string, request: ExecTaskRequest): Promise<ExecTaskResult>;
  finish(taskId: string, request: FinishTaskRequest): Promise<BrokerTask>;
  agentWork(taskId: string, agentToken: string): Promise<QueuedWork | null>;
  agentResult(
    taskId: string,
    commandId: string,
    agentToken: string,
    result: AgentResultPayload,
  ): Promise<void>;
  sweep(): Promise<void>;
}

export function createBroker(options: BrokerOptions): Broker {
  const {
    gce,
    store,
    brokerUrl,
    githubToken,
    now = () => new Date(),
    randomToken = () => randomBytes(32).toString("base64url"),
    pollIntervalMs = 1000,
    longPollHoldMs = 20_000,
    execGraceSeconds = 30,
    maxExecTimeoutSeconds = 600,
  } = options;

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  function tokensMatch(given: string, expected: string): boolean {
    if (given.length === 0 || expected.length === 0) return false;
    const givenBuf = Buffer.from(given, "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");
    return (
      givenBuf.length === expectedBuf.length &&
      timingSafeEqual(givenBuf, expectedBuf)
    );
  }

  function taskKeyToId(idempotencyKey: string): string {
    const hash = createHash("sha256")
      .update(idempotencyKey)
      .digest("hex")
      .slice(0, 16);
    return `task-${hash}`;
  }

  function toWireTask(record: BrokerTaskRecord): BrokerTask {
    return {
      apiVersion: BROKER_API_VERSION,
      id: record.id,
      status: record.status,
      request: record.request,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      expiresAt: record.expiresAt,
      ...(record.failure ? { failure: record.failure } : {}),
    };
  }

  async function start(request: StartTaskRequest): Promise<BrokerTask> {
    const profile = EXECUTION_PROFILES[request.profile];
    if (!profile) {
      throw new BrokerHttpError(
        400,
        "unknown_profile",
        `Unknown execution profile: ${request.profile}.`,
      );
    }
    if (profile.requiresReason) {
      if (!request.reason) {
        throw new BrokerHttpError(
          400,
          "reason_required",
          `Execution profile ${profile.name} requires a reason.`,
        );
      }
      if (
        profile.allowedReasons &&
        !profile.allowedReasons.includes(request.reason)
      ) {
        throw new BrokerHttpError(
          400,
          "reason_not_allowed",
          `Execution profile ${profile.name} does not allow reason ${request.reason}.`,
        );
      }
    }
    const backend = INSTANCE_BACKENDS[request.profile];
    if (!backend) {
      throw new BrokerHttpError(
        400,
        "profile_backend_unavailable",
        `Execution profile ${profile.name} has no backend on this broker yet.`,
      );
    }

    const taskId = taskKeyToId(request.idempotencyKey);
    const existing = await store.getTask(taskId);
    if (existing && existing.status !== "failed") return toWireTask(existing);

    // Reap before counting against the profile's concurrency limit.
    await sweep();
    const tasks = await store.listTasks();
    const activeForProfile = tasks.filter(
      (task) =>
        task.request.profile === profile.name &&
        ACTIVE_STATUSES.has(task.status),
    );
    if (activeForProfile.length >= profile.limits.maxConcurrentTasks) {
      throw new BrokerHttpError(
        429,
        "limit_reached",
        `Execution profile ${profile.name} is at its limit of ${profile.limits.maxConcurrentTasks} concurrent tasks.`,
      );
    }

    const nowMs = now().getTime();
    const createdAt = existing?.createdAt ?? new Date(nowMs).toISOString();
    const expiresAt = new Date(
      nowMs + profile.limits.maxLifetimeMinutes * 60_000,
    ).toISOString();
    const record: BrokerTaskRecord = {
      id: taskId,
      status: "provisioning",
      request,
      createdAt,
      updatedAt: new Date(nowMs).toISOString(),
      expiresAt,
      agentToken: randomToken(),
    };
    await store.putTask(record);
    try {
      await gce.createInstance({
        name: taskId,
        machineType: backend.machineType,
        sourceImage: backend.sourceImage,
        diskSizeGb: backend.diskSizeGb,
        labels: {
          "managed-by": "compute-broker",
          task: taskId,
          profile: request.profile,
          "expires-at": String(
            Math.floor(new Date(expiresAt).getTime() / 1000),
          ),
        },
        startupScript: workerStartupScript({
          brokerUrl,
          taskId,
          agentToken: record.agentToken,
          repository: request.repository,
          baseRef: request.baseRef,
          branch: request.branch,
          maxLifetimeMinutes: profile.limits.maxLifetimeMinutes,
          githubToken,
        }),
      });
    } catch (error) {
      if (error instanceof BrokerHttpError && error.code === "already_exists") {
        // A concurrent start with the same idempotency key won the create
        // race; its task record is the source of truth.
        const raced = await store.getTask(taskId);
        if (raced) return toWireTask(raced);
      }
      record.status = "failed";
      record.failure = {
        code: "provisioning_failed",
        message:
          error instanceof Error ? error.message : "unknown provisioning error",
      };
      record.updatedAt = new Date(now().getTime()).toISOString();
      await store.putTask(record);
    }
    return toWireTask(record);
  }

  async function status(taskId: string): Promise<BrokerTask> {
    const record = await store.getTask(taskId);
    if (!record) {
      throw new BrokerHttpError(
        404,
        "task_not_found",
        `Unknown task: ${taskId}.`,
      );
    }
    if (TERMINAL_STATUSES.has(record.status)) return toWireTask(record);

    const instance = await gce.getInstance(taskId);
    const profile = EXECUTION_PROFILES[record.request.profile];
    const nowMs = now().getTime();

    if (!instance) {
      record.status = "failed";
      record.failure = {
        code: "instance_missing",
        message: "The worker instance no longer exists.",
      };
    } else if (instance.status === "TERMINATED") {
      if (nowMs >= Date.parse(record.expiresAt)) {
        record.status = "expired";
      } else {
        record.status = "failed";
        record.failure = {
          code: "instance_terminated",
          message: "The worker instance terminated before its expiry.",
        };
      }
    } else if (instance.status === "RUNNING") {
      const lastSeen = record.lastSeenAt ? Date.parse(record.lastSeenAt) : 0;
      const idleLimitMs = (profile?.limits.idleTtlMinutes ?? 20) * 60_000;
      if (lastSeen > 0 && nowMs - lastSeen > idleLimitMs) {
        await gce.deleteInstance(taskId).catch(() => undefined);
        record.status = "expired";
      } else {
        // The agent's first poll is what flips a live instance from
        // "provisioning" (still installing its toolchain) to "running".
        record.status = lastSeen > 0 ? "running" : "provisioning";
      }
    } else {
      record.status = "provisioning";
    }

    record.updatedAt = new Date(nowMs).toISOString();
    await store.putTask(record);
    return toWireTask(record);
  }

  async function exec(
    taskId: string,
    request: ExecTaskRequest,
  ): Promise<ExecTaskResult> {
    const record = await store.getTask(taskId);
    if (!record) {
      throw new BrokerHttpError(
        404,
        "task_not_found",
        `Unknown task: ${taskId}.`,
      );
    }
    if (TERMINAL_STATUSES.has(record.status) || record.status === "finishing") {
      throw new BrokerHttpError(
        409,
        "task_not_active",
        `Task ${taskId} is ${record.status} and cannot execute commands.`,
      );
    }

    const timeoutSeconds = Math.min(
      request.timeoutSeconds ?? 300,
      maxExecTimeoutSeconds,
    );
    const commandId = randomUUID();
    const createdAt = new Date(now().getTime()).toISOString();
    const command: CommandRecord = {
      commandId,
      taskId,
      status: "queued",
      argv: request.argv,
      ...(request.cwd ? { cwd: request.cwd } : {}),
      timeoutSeconds,
      createdAt,
    };
    await store.putCommand(command);

    const deadline =
      now().getTime() + (timeoutSeconds + execGraceSeconds) * 1000;
    while (now().getTime() < deadline) {
      await sleep(pollIntervalMs);
      const stored = await store.getCommand(taskId, commandId);
      if (stored?.value.status === "done" && stored.value.result) {
        const result = stored.value.result;
        return {
          apiVersion: BROKER_API_VERSION,
          taskId,
          commandId,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          startedAt: result.startedAt,
          finishedAt: result.finishedAt,
        };
      }
    }

    await store.putCommand({ ...command, status: "expired" });
    return {
      apiVersion: BROKER_API_VERSION,
      taskId,
      commandId,
      exitCode: -1,
      stdout: "",
      stderr: `broker: command timed out after ${timeoutSeconds}s`,
      startedAt: command.createdAt,
      finishedAt: new Date(now().getTime()).toISOString(),
    };
  }

  async function finish(
    taskId: string,
    request: FinishTaskRequest,
  ): Promise<BrokerTask> {
    const record = await store.getTask(taskId);
    if (!record) {
      throw new BrokerHttpError(
        404,
        "task_not_found",
        `Unknown task: ${taskId}.`,
      );
    }
    if (TERMINAL_STATUSES.has(record.status)) return toWireTask(record);

    record.status = "finishing";
    record.outcome = request.outcome;
    record.updatedAt = new Date(now().getTime()).toISOString();
    await store.putTask(record);

    await gce.deleteInstance(taskId).catch(() => undefined);

    record.status = "finished";
    record.updatedAt = new Date(now().getTime()).toISOString();
    await store.putTask(record);
    return toWireTask(record);
  }

  async function agentWork(
    taskId: string,
    agentToken: string,
  ): Promise<QueuedWork | null> {
    const record = await store.getTask(taskId);
    if (!record) {
      throw new BrokerHttpError(
        404,
        "task_not_found",
        `Unknown task: ${taskId}.`,
      );
    }
    if (!tokensMatch(agentToken, record.agentToken)) {
      throw new BrokerHttpError(
        403,
        "agent_forbidden",
        "Invalid agent token for this task.",
      );
    }

    record.lastSeenAt = new Date(now().getTime()).toISOString();
    await store.putTask(record);

    const deadline = now().getTime() + longPollHoldMs;
    while (now().getTime() < deadline) {
      const commands = await store.listCommands(taskId);
      const queued = commands.find((entry) => entry.value.status === "queued");
      if (queued) {
        const claimed: CommandRecord = {
          ...queued.value,
          status: "claimed",
          claimedAt: new Date(now().getTime()).toISOString(),
        };
        const claimedOk = await store.putCommand(claimed, {
          ifGenerationMatch: queued.generation,
        });
        if (claimedOk) {
          return {
            commandId: claimed.commandId,
            argv: claimed.argv,
            ...(claimed.cwd ? { cwd: claimed.cwd } : {}),
            timeoutSeconds: claimed.timeoutSeconds,
          };
        }
      }
      await sleep(pollIntervalMs);
    }
    return null;
  }

  async function agentResult(
    taskId: string,
    commandId: string,
    agentToken: string,
    result: AgentResultPayload,
  ): Promise<void> {
    const record = await store.getTask(taskId);
    if (!record) {
      throw new BrokerHttpError(
        404,
        "task_not_found",
        `Unknown task: ${taskId}.`,
      );
    }
    if (!tokensMatch(agentToken, record.agentToken)) {
      throw new BrokerHttpError(
        403,
        "agent_forbidden",
        "Invalid agent token for this task.",
      );
    }
    const stored = await store.getCommand(taskId, commandId);
    if (!stored) {
      throw new BrokerHttpError(
        404,
        "command_not_found",
        `Unknown command: ${commandId}.`,
      );
    }
    if (stored.value.status === "done") return; // idempotent redelivery

    const updated: CommandRecord = {
      ...stored.value,
      status: "done",
      result: {
        exitCode: result.exitCode,
        stdout: result.stdout.slice(0, MAX_OUTPUT_CHARS),
        stderr: result.stderr.slice(0, MAX_OUTPUT_CHARS),
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
      },
    };
    await store.putCommand(updated);
  }

  async function sweep(): Promise<void> {
    const tasks = await store.listTasks();
    const nowMs = now().getTime();
    for (const task of tasks) {
      if (TERMINAL_STATUSES.has(task.status)) continue;
      const profile = EXECUTION_PROFILES[task.request.profile];
      const idleLimitMs = (profile?.limits.idleTtlMinutes ?? 20) * 60_000;
      const hardExpired = nowMs >= Date.parse(task.expiresAt);
      const idleExpired = task.lastSeenAt
        ? nowMs - Date.parse(task.lastSeenAt) > idleLimitMs
        : false;
      if (!hardExpired && !idleExpired) continue;
      await gce.deleteInstance(task.id).catch(() => undefined);
      task.status = "expired";
      task.updatedAt = new Date(nowMs).toISOString();
      await store.putTask(task);
    }
  }

  return { start, status, exec, finish, agentWork, agentResult, sweep };
}
