/**
 * In-memory ring buffer for handshake debug events.
 *
 * Vercel serverless functions share module state within a single function
 * instance, so logs from the same instance are accumulated here. The buffer
 * is capped at 200 entries to avoid memory growth. Because Vercel may spin
 * up multiple instances, logs are partitioned by instance — the debug
 * endpoint returns what the queried instance saw, which is enough to trace
 * a single mobile session (all requests in one session typically land on the
 * same warm instance).
 *
 * This is temporary instrumentation — remove once the stuck-skeleton bug is
 * diagnosed.
 */

export interface HandshakeLogEntry {
  ts: string; // ISO timestamp
  route: string; // e.g. "lockfile", "gateway-token", "status", "validate-token"
  method: string;
  status: number | null; // response status, null if not yet set
  detail: string; // freeform context (auth header presence, token shape, etc.)
}

// Module-level ring buffer — persists across requests on the same instance.
const MAX_ENTRIES = 200;
const entries: HandshakeLogEntry[] = [];

export function logHandshake(entry: Omit<HandshakeLogEntry, "ts">) {
  if (entries.length >= MAX_ENTRIES) {
    entries.shift();
  }
  entries.push({ ts: new Date().toISOString(), ...entry });
}

export function getHandshakeLogs(): HandshakeLogEntry[] {
  return [...entries];
}

export function clearHandshakeLogs() {
  entries.length = 0;
}
