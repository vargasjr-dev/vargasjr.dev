import { NextResponse } from "next/server";

/**
 * Local assistant status check.
 *
 * The SPA's auth-store fires `re(assistantId)` (= `ts(e)` in local-mode.js)
 * during bootstrap to determine whether the local assistant host is reachable.
 * The function (see public/assistant/assets/local-mode-CvrNMtPF.js around
 * byte offset 74461) does:
 *
 *   let t = await fetch(`/assistant/__local/status/${encodeURIComponent(e)}`);
 *   return await t.json().catch(() => null) ?? {ok:false, status:t.status, error:J};
 *
 * J = "The local assistant host isn't available here."
 *
 * The auth-store caller (auth-store-Kfxhs2oI.js around offset 9309) consumes
 * the returned `.state` field and switches on values:
 *   - 'healthy' / 'sleeping' / 'starting' / 'upgrading' / 'crashed' → use as-is
 *   - 'unknown' → fall through to other state checks
 *   - anything else (including null) → 'unreachable'
 *
 * If status is null/404, the auth-store marks the assistant 'unreachable' and
 * breaks the local-mode bootstrap — subsequent /v1/* calls fire before the
 * gateway handshake completes, so they go out without an Authorization
 * header and 401.
 *
 * Response shape: {ok: true, state: 'healthy'} — matches the desktop-app
 * `window.vellum.localMode.status(assistantId)` contract from the bundled
 * local-mode.js.
 *
 * This is intentionally public and local to the web deployment for now.
 * TODO: Remove this shim when the upstream Vellum local-mode health flow is
 * made efficient and no longer requires this browser-side probe.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    state: "healthy",
  });
}
