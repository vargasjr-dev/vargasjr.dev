import { BrokerHttpError } from "./contract";
import { metadataAccessToken } from "./gcp-auth";

import type {
  FinishTaskRequest,
  StartTaskRequest,
  TaskStatus,
} from "./contract";

// Task and command state lives as JSON objects in a dedicated GCS bucket.
// A generation-precondition write (412 → false) makes command claims safe
// across multiple Cloud Run broker instances without a database.

export interface BrokerTaskRecord {
  id: string;
  status: TaskStatus;
  request: StartTaskRequest;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  agentToken: string;
  lastSeenAt?: string;
  failure?: { code: string; message: string };
  outcome?: FinishTaskRequest["outcome"];
}

export interface CommandRecord {
  commandId: string;
  taskId: string;
  status: "queued" | "claimed" | "done" | "expired";
  argv: string[];
  cwd?: string;
  timeoutSeconds: number;
  createdAt: string;
  claimedAt?: string;
  result?: {
    exitCode: number;
    stdout: string;
    stderr: string;
    startedAt: string;
    finishedAt: string;
  };
}

export interface Stored<T> {
  value: T;
  generation: number;
}

export interface StateStore {
  getTask(taskId: string): Promise<BrokerTaskRecord | null>;
  putTask(record: BrokerTaskRecord): Promise<void>;
  listTasks(): Promise<BrokerTaskRecord[]>;
  getCommand(
    taskId: string,
    commandId: string,
  ): Promise<Stored<CommandRecord> | null>;
  putCommand(
    record: CommandRecord,
    opts?: { ifGenerationMatch?: number },
  ): Promise<boolean>;
  listCommands(taskId: string): Promise<Stored<CommandRecord>[]>;
}

export function createGcsStore(
  bucket: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): StateStore {
  const metadataBase = `https://storage.googleapis.com/storage/v1/b/${bucket}/o`;
  const uploadBase = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o`;

  async function token(): Promise<string> {
    return metadataAccessToken(fetchImpl);
  }

  async function getObject(
    path: string,
  ): Promise<{ value: unknown; generation: number } | null> {
    const response = await fetchImpl(
      `${metadataBase}/${encodeURIComponent(path)}?alt=media`,
      {
        headers: { authorization: `Bearer ${await token()}` },
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new BrokerHttpError(
        502,
        "state_read_failed",
        `State read failed (${response.status}).`,
      );
    }
    const generation = Number(response.headers.get("x-goog-generation") ?? "0");
    return { value: await response.json(), generation };
  }

  async function putObject(
    path: string,
    value: unknown,
    ifGenerationMatch?: number,
  ): Promise<boolean> {
    const url = new URL(uploadBase);
    url.searchParams.set("uploadType", "media");
    url.searchParams.set("name", path);
    const headers: Record<string, string> = {
      authorization: `Bearer ${await token()}`,
      "content-type": "application/json",
    };
    if (ifGenerationMatch !== undefined) {
      headers["x-goog-if-generation-match"] = String(ifGenerationMatch);
    }
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(value),
    });
    if (response.ok) return true;
    if (response.status === 412) return false;
    throw new BrokerHttpError(
      502,
      "state_write_failed",
      `State write failed (${response.status}).`,
    );
  }

  async function listObjectNames(prefix: string): Promise<string[]> {
    const url = new URL(metadataBase);
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("maxResults", "1000");
    const response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    if (!response.ok) {
      throw new BrokerHttpError(
        502,
        "state_list_failed",
        `State list failed (${response.status}).`,
      );
    }
    const body = (await response.json()) as { items?: { name?: unknown }[] };
    return (body.items ?? [])
      .filter((item): item is { name: string } => typeof item.name === "string")
      .map((item) => decodeURIComponent(item.name));
  }

  function isTaskRecord(value: unknown): value is BrokerTaskRecord {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as BrokerTaskRecord).id === "string"
    );
  }

  function isCommandRecord(value: unknown): value is CommandRecord {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as CommandRecord).commandId === "string"
    );
  }

  return {
    async getTask(taskId) {
      const stored = await getObject(`tasks/${taskId}.json`);
      if (!stored || !isTaskRecord(stored.value)) return null;
      return stored.value;
    },
    async putTask(record) {
      await putObject(`tasks/${record.id}.json`, record);
    },
    async listTasks() {
      const names = await listObjectNames("tasks/");
      const taskNames = names.filter(
        (name) => name.endsWith(".json") && !name.includes("/commands/"),
      );
      const tasks: BrokerTaskRecord[] = [];
      for (const name of taskNames) {
        const stored = await getObject(name);
        if (stored && isTaskRecord(stored.value)) tasks.push(stored.value);
      }
      return tasks;
    },
    async getCommand(taskId, commandId) {
      const stored = await getObject(
        `tasks/${taskId}/commands/${commandId}.json`,
      );
      if (!stored || !isCommandRecord(stored.value)) return null;
      return { value: stored.value, generation: stored.generation };
    },
    async putCommand(record, opts) {
      return putObject(
        `tasks/${record.taskId}/commands/${record.commandId}.json`,
        record,
        opts?.ifGenerationMatch,
      );
    },
    async listCommands(taskId) {
      const names = await listObjectNames(`tasks/${taskId}/commands/`);
      const commands: Stored<CommandRecord>[] = [];
      for (const name of names) {
        if (!name.endsWith(".json")) continue;
        const stored = await getObject(name);
        if (stored && isCommandRecord(stored.value)) {
          commands.push({ value: stored.value, generation: stored.generation });
        }
      }
      return commands;
    },
  };
}
