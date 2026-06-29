import { NextResponse } from "next/server";

/**
 * Short-circuit interceptor for GET /v1/assistants
 *
 * The SPA's `x()` helper calls `/v1/assistants?hosting=platform` first to
 * look up a platform-hosted assistant, then falls through to `hosting=local`.
 * If the response is non-OK (e.g., 404), the helper bails with an error
 * instead of falling through — so a 404 from the daemon breaks the local-mode
 * bootstrap even though local mode should work fine without any platform
 * assistants.
 *
 * Mocking with `{ results: [] }` lets the SPA proceed to the `hosting=local`
 * branch (and ultimately to the locally-cached assistant from localStorage).
 */
export async function GET() {
  return NextResponse.json({ results: [] });
}