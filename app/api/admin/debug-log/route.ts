import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getHandshakeLogs, clearHandshakeLogs } from "@/lib/handshake-log";

/**
 * Temporary debug endpoint — returns the in-memory handshake log for this
 * Vercel function instance so mobile sessions can be diagnosed without
 * browser DevTools.
 *
 * GET    /api/admin/debug-log  — return current log as JSON
 * DELETE /api/admin/debug-log  — clear the log
 *
 * Auth (either):
 *   - admin_session HttpOnly cookie (set by /api/admin/validate-token)
 *   - Authorization: Bearer <ADMIN_TOKEN> header (for server-side queries)
 *
 * Remove this route once the stuck-skeleton bug is diagnosed.
 */
function isAuthorized(request: NextRequest, cookieValue: string | undefined) {
  if (cookieValue) return true;
  const authHeader = request.headers.get("authorization");
  const adminToken = process.env.ADMIN_TOKEN;
  if (!authHeader || !adminToken) return false;
  return authHeader === `Bearer ${adminToken}`;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  if (!isAuthorized(request, cookieStore.get("admin_session")?.value)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const logs = getHandshakeLogs();
  return NextResponse.json(
    {
      count: logs.length,
      instanceNote:
        "Vercel may run multiple instances — these are logs from the instance that handled this request.",
      logs,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  if (!isAuthorized(request, cookieStore.get("admin_session")?.value)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  clearHandshakeLogs();
  return NextResponse.json({ cleared: true });
}
