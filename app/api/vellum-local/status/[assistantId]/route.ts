import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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
 * Auth: admin_session cookie (same as /assistant/__local/lockfile).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> },
) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_session")?.value) {
    return new NextResponse(null, { status: 401 });
  }

  const { assistantId } = await params;
  const expectedId = process.env.VELLUM_ASSISTANT_ID;

  // If the URL's assistantId doesn't match the configured local assistant,
  // return ok:false so the SPA can fall through to other state checks
  // (and so we don't pretend to host a different assistant).
  if (!expectedId || assistantId !== expectedId) {
    return NextResponse.json({
      ok: false,
      status: 404,
      error: "Assistant not found",
    });
  }

  return NextResponse.json({
    ok: true,
    state: "healthy",
  });
}