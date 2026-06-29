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
 *
 * `ingress_url` + `platform_actor_token` are CRITICAL: the SPA's
 * `projectSelfHosted(e)` helper calls `_e({url: e.data.ingress_url,
 * token: e.data.platform_actor_token})` (= `h()` in the bundle) which sets
 * `ge = {url, token}` — the state the C5() interceptor reads via `In()` and
 * `Rn()` to add the Authorization header. If these fields are undefined,
 * `ge = {url: undefined, token: undefined}` → `Rn()` returns undefined →
 * C5 deletes the Authorization header → every /v1/* call 401s.
 *
 * `ingress_url` is set to the local gateway URL so `In()` returns a valid
 * origin that matches `n.origin` (same-origin deploy); the SPA's relative
 * `/v1/*` paths get rewritten by Next.js to `${VELLUM_API_URL}/v1/*` and
 * Authorization is forwarded.
 *
 * `platform_actor_token` is the VELLUM_ACCESS_TOKEN — the daemon uses it to
 * authenticate the local assistant's API calls. The lockfile route already
 * returns this token in its `token` field (used by the local-mode handshake
 * POST /assistant/__gateway/7830/auth/token), so reusing it here keeps a
 * single source of truth.
 */
export async function GET(request: NextRequest) {
  const hosting = request.nextUrl.searchParams.get("hosting");

  if (hosting !== "local") {
    return NextResponse.json({ results: [] });
  }

  const assistantId = process.env.VELLUM_ASSISTANT_ID;
  const accessToken = process.env.VELLUM_ACCESS_TOKEN;
  if (!assistantId) {
    return NextResponse.json({ results: [] });
  }

  // Use the request origin so `ge.url` is same-origin (matches `n.origin`
  // for the SPA's `/v1/*` relative paths). C5()'s origin check
  // (`n.origin !== r.origin`) then allows Authorization injection when the
  // pathname matches `/v1/*` (also patched).
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    results: [
      {
        id: assistantId,
        assistantId,
        name: "VargasJR",
        status: "active",
        is_local: true,
        created: "2026-01-01T00:00:00Z",
        ingress_url: `${origin}/assistant/__gateway/7830`,
        platform_actor_token: accessToken ?? null,
      },
    ],
  });
}