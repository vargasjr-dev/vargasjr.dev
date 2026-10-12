import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  BROKER_API_VERSION,
  BrokerHttpError,
  agentResultSchema,
  brokerErrorBody,
  execTaskRequestSchema,
  finishTaskRequestSchema,
  startTaskRequestSchema,
} from "./contract";
import { EXECUTION_PROFILES } from "./profiles";
import type { Broker } from "./broker";

// HTTP surface. The client plane (force plugin) authenticates with the
// broker token; the agent plane (worker VMs) authenticates with per-task
// agent tokens issued at provisioning time.

export interface ServerOptions {
  broker: Broker;
  brokerToken?: string;
}

const TASK_ID_PATTERN = /^task-[a-z0-9-]{6,64}$/;
const MAX_CLIENT_BODY_BYTES = 64 * 1024;
const MAX_AGENT_BODY_BYTES = 4 * 1024 * 1024;

function bearer(req: http.IncomingMessage): string {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : header;
}

export function createServer(options: ServerOptions): http.Server {
  const { broker } = options;

  function brokerAuthorized(req: http.IncomingMessage): boolean {
    const expected = options.brokerToken ?? "";
    if (expected.length === 0) return false;
    const expectedBuf = Buffer.from(`Bearer ${expected}`, "utf8");
    const givenBuf = Buffer.from(req.headers.authorization ?? "", "utf8");
    return (
      givenBuf.length === expectedBuf.length &&
      timingSafeEqual(givenBuf, expectedBuf)
    );
  }

  async function readBody(
    req: http.IncomingMessage,
    capBytes: number,
  ): Promise<unknown> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      const buf = chunk as Buffer;
      total += buf.length;
      if (total > capBytes) {
        throw new BrokerHttpError(
          413,
          "payload_too_large",
          `Request body exceeds ${capBytes} bytes.`,
        );
      }
      chunks.push(buf);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    if (text.length === 0) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new BrokerHttpError(
        400,
        "invalid_json",
        "Request body must be valid JSON.",
      );
    }
  }

  function json(
    res: http.ServerResponse,
    statusCode: number,
    body: unknown,
  ): void {
    res.writeHead(statusCode, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  }

  function respondError(res: http.ServerResponse, error: unknown): void {
    if (error instanceof BrokerHttpError) {
      json(res, error.status, brokerErrorBody(error.code, error.message));
      return;
    }
    if (error instanceof z.ZodError) {
      const message = error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; ");
      json(res, 400, brokerErrorBody("invalid_request", message));
      return;
    }
    console.error("[compute-broker] unhandled error:", error);
    json(
      res,
      500,
      brokerErrorBody("internal_error", "Unexpected broker error."),
    );
  }

  return http.createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const method = req.method ?? "GET";
        const route = `${method} ${url.pathname}`;

        if (route === "GET /v1/healthz") {
          json(res, 200, { ok: true, apiVersion: BROKER_API_VERSION });
          return;
        }

        // Agent plane: per-task agent tokens, never the broker token.
        if (route === "GET /v1/agent/work") {
          const taskId = url.searchParams.get("taskId") ?? "";
          const agentToken = bearer(req);
          if (!TASK_ID_PATTERN.test(taskId)) {
            throw new BrokerHttpError(
              400,
              "invalid_request",
              "taskId is malformed.",
            );
          }
          if (agentToken.length === 0) {
            throw new BrokerHttpError(
              401,
              "unauthorized",
              "Missing agent token.",
            );
          }
          const work = await broker.agentWork(taskId, agentToken);
          if (work === null) {
            res.writeHead(204);
            res.end();
            return;
          }
          json(res, 200, work);
          return;
        }
        if (route === "POST /v1/agent/result") {
          const body = agentResultSchema.parse(
            await readBody(req, MAX_AGENT_BODY_BYTES),
          );
          const agentToken = bearer(req);
          if (agentToken.length === 0) {
            throw new BrokerHttpError(
              401,
              "unauthorized",
              "Missing agent token.",
            );
          }
          await broker.agentResult(
            body.taskId,
            body.commandId,
            agentToken,
            body,
          );
          json(res, 200, { ok: true });
          return;
        }

        if (!brokerAuthorized(req)) {
          throw new BrokerHttpError(
            401,
            "unauthorized",
            "Missing or invalid bearer token.",
          );
        }

        if (route === "GET /v1/profiles") {
          json(res, 200, {
            apiVersion: BROKER_API_VERSION,
            profiles: Object.values(EXECUTION_PROFILES),
          });
          return;
        }
        if (route === "POST /v1/tasks") {
          const body = startTaskRequestSchema.parse(
            await readBody(req, MAX_CLIENT_BODY_BYTES),
          );
          json(res, 200, await broker.start(body));
          return;
        }

        const execMatch = url.pathname.match(
          /^\/v1\/tasks\/(task-[a-z0-9-]{6,64})\/exec$/,
        );
        if (execMatch && method === "POST") {
          const body = execTaskRequestSchema.parse(
            await readBody(req, MAX_CLIENT_BODY_BYTES),
          );
          json(res, 200, await broker.exec(execMatch[1], body));
          return;
        }
        const finishMatch = url.pathname.match(
          /^\/v1\/tasks\/(task-[a-z0-9-]{6,64})\/finish$/,
        );
        if (finishMatch && method === "POST") {
          const body = finishTaskRequestSchema.parse(
            await readBody(req, MAX_CLIENT_BODY_BYTES),
          );
          json(res, 200, await broker.finish(finishMatch[1], body));
          return;
        }
        const statusMatch = url.pathname.match(
          /^\/v1\/tasks\/(task-[a-z0-9-]{6,64})$/,
        );
        if (statusMatch && method === "GET") {
          json(res, 200, await broker.status(statusMatch[1]));
          return;
        }

        throw new BrokerHttpError(
          404,
          "route_not_found",
          `No route for ${method} ${url.pathname}.`,
        );
      } catch (error) {
        respondError(res, error);
      }
    })();
  });
}
