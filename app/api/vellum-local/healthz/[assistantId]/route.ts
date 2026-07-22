import { NextResponse } from "next/server";

/**
 * Temporary web-hosted health check short-circuit.
 *
 * The copied SPA polls this endpoint through the gateway during local-mode
 * bootstrap. Returning a healthy response here prevents the request from
 * reaching the assistant while the Vellum-side heartbeat is made more
 * efficient.
 *
 * TODO: Remove this shim when the upstream Vellum local-mode health flow no
 * longer requires a recurring browser-side probe for this deployment.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
  });
}
