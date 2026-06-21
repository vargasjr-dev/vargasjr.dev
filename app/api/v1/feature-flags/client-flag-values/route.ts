import { NextResponse } from "next/server";

/**
 * Short-circuit interceptor for GET /v1/feature-flags/client-flag-values
 *
 * Problem: the SPA fires this endpoint without an Authorization header on
 * every reconnect and whenever the gateway pushes a `feature_flags_changed`
 * SSE event. The gateway's rate-limiter is IP-based (all traffic arrives
 * from the Docker bridge 172.19.0.1), so accumulating enough unauthenticated
 * hits trips the limiter and 429s ALL requests — including authenticated ones
 * — for ~5 minutes.
 *
 * Fix: Next.js matches API routes before rewrites(), so this route intercepts
 * the request before it ever reaches the gateway. We return an empty flag list;
 * window.__VELLUM_FLAG_OVERRIDES__ (injected at build time in copy-assistant.ts)
 * handles all the flags we actually care about on the client side.
 */
export async function GET() {
  return NextResponse.json([]);
}
