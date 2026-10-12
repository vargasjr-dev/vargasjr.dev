import { z } from "zod";

// The wire contract mirrors the force plugin's DisposableComputeBroker
// protocol (services must accept exactly what HttpDisposableComputeBroker
// sends and emit exactly what its strict parsers accept — unknown fields
// are rejected on both sides, so the field sets below are load-bearing).

export const BROKER_API_VERSION = "v1";
export const EXECUTION_PROFILE_SCHEMA_VERSION = 1;

export type TaskStatus =
  | "queued"
  | "provisioning"
  | "ready"
  | "running"
  | "finishing"
  | "finished"
  | "failed"
  | "expired";

const nonEmptyString = z
  .string()
  .refine((value) => value.trim().length > 0, "must be a non-empty string");

export const startTaskRequestSchema = z
  .object({
    apiVersion: z.literal(BROKER_API_VERSION),
    profile: nonEmptyString,
    repository: z
      .string()
      .regex(
        /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
        "repository must use owner/name form.",
      ),
    baseRef: nonEmptyString,
    branch: z
      .string()
      .regex(/^[A-Za-z0-9_./-]+$/, "branch contains unsupported characters."),
    idempotencyKey: nonEmptyString,
    reason: nonEmptyString.optional(),
  })
  .strict();

export const execTaskRequestSchema = z
  .object({
    apiVersion: z.literal(BROKER_API_VERSION),
    argv: z.array(nonEmptyString).min(1),
    cwd: nonEmptyString.optional(),
    timeoutSeconds: z.number().int().positive().optional(),
  })
  .strict();

export const finishTaskRequestSchema = z
  .object({
    apiVersion: z.literal(BROKER_API_VERSION),
    outcome: z.enum(["completed", "abandoned"]),
  })
  .strict();

export const agentResultSchema = z
  .object({
    apiVersion: z.literal(BROKER_API_VERSION),
    taskId: nonEmptyString,
    commandId: nonEmptyString,
    exitCode: z.number().int(),
    stdout: z.string(),
    stderr: z.string(),
    startedAt: nonEmptyString,
    finishedAt: nonEmptyString,
  })
  .strict();

export type StartTaskRequest = z.infer<typeof startTaskRequestSchema>;
export type ExecTaskRequest = z.infer<typeof execTaskRequestSchema>;
export type FinishTaskRequest = z.infer<typeof finishTaskRequestSchema>;
export type AgentResultBody = z.infer<typeof agentResultSchema>;

export interface BrokerTask {
  apiVersion: string;
  id: string;
  status: TaskStatus;
  request: StartTaskRequest;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  failure?: { code: string; message: string };
}

export interface ExecTaskResult {
  apiVersion: string;
  taskId: string;
  commandId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
}

export interface QueuedWork {
  commandId: string;
  argv: string[];
  cwd?: string;
  timeoutSeconds: number;
}

export class BrokerHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "BrokerHttpError";
    this.status = status;
    this.code = code;
  }
}

export function brokerErrorBody(
  code: string,
  message: string,
): {
  apiVersion: string;
  error: { code: string; message: string };
} {
  return { apiVersion: BROKER_API_VERSION, error: { code, message } };
}
