import { type NextRequest, NextResponse } from "next/server";

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
 * Mocking based on `hosting`:
 *   - `hosting=platform` → empty results, so x() falls through to local
 *   - `hosting=local`    → the local assistant, so x() returns it and the
 *                          SPA can fire the rest of the bootstrap API calls
 *                          (platform/status, permissions, contacts, etc.)
 *
 * The assistant ID must match VELLUM_ASSISTANT_ID — that's the ID the SPA
 * stored in localStorage from the lockfile, and it uses it as the path
 * segment for all subsequent `/v1/assistants/{id}/...` calls.
 */
export async function GET(request: NextRequest) {
  const hosting = request.nextUrl.searchParams.get("hosting");

  if (hosting !== "local") {
    return NextResponse.json({ results: [] });
  }

  const assistantId = process.env.VELLUM_ASSISTANT_ID;
  if (!assistantId) {
    return NextResponse.json({ results: [] });
  }

  return NextResponse.json({
    results: [
      {
        id: assistantId,
        assistantId,
        name: "VargasJR",
        status: "active",
        is_local: true,
        created: "2026-01-01T00:00:00Z",
      },
    ],
  });
}