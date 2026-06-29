import { type NextRequest, NextResponse } from "next/server";

/**
 * Mock for GET/PUT /v1/user/consent/
 *
 * The SPA's auth-store fires `Br()` (auth-store-Kfxhs2oI.js) which does:
 *   let {data, error, response} = await C.get({url: `/v1/user/consent/`, throwOnError: !1});
 *   if (!n.ok || !e) throw new Se(n.status, S(t, n, `Failed to load consent.`));
 *   return e;
 *
 * The returned `data` is passed through `ai()` which parses fields like
 * `tos_accepted_version`, `privacy_policy_accepted_version`, `share_analytics`,
 * `share_diagnostics`. Returning a "current + accepted" record prevents the
 * SPA from triggering re-consent flows and `Ur()` from prompting the user to
 * re-accept terms on every page load.
 *
 * `Vr(e)` PUTs consent updates — we accept and return success so the SPA can
 * cache updated values locally without the daemon rejecting them.
 *
 * Field semantics (from ai() in auth-store-Kfxhs2oI.js):
 *   tos_accepted_version / privacy_policy_accepted_version: truthy = accepted
 *   share_analytics / share_diagnostics: nullable boolean (null = unset)
 *   analytics_current / diagnostics_current: true = up-to-date with current policy
 *   has_server_record: true = we have a stored consent record on the server
 */
export async function GET() {
  return NextResponse.json({
    tos_accepted_version: "2026-01-01",
    privacy_policy_accepted_version: "2026-01-01",
    share_analytics: false,
    share_diagnostics: false,
    analytics_current: true,
    diagnostics_current: true,
    has_server_record: true,
  });
}

export async function PUT(request: NextRequest) {
  // Accept the consent update; echo the merged state. We don't persist
  // anything server-side — the SPA caches to localStorage for runtime use.
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({
    tos_accepted_version: "2026-01-01",
    privacy_policy_accepted_version: "2026-01-01",
    share_analytics: body.share_analytics ?? false,
    share_diagnostics: body.share_diagnostics ?? false,
    analytics_current: true,
    diagnostics_current: true,
    has_server_record: true,
  });
}