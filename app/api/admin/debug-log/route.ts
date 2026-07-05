import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getHandshakeLogs, clearHandshakeLogs } from "@/lib/handshake-log";

/**
 * Temporary debug endpoint — returns the in-memory handshake log for this
 * Vercel function instance so mobile sessions can be diagnosed without
 * browser DevTools.
 *
 * GET  /api/admin/debug-log         — return current log as JSON
 * DELETE /api/admin/debug-log       — clear the log
 *
 * Auth: admin_session cookie (same as all /admin/* routes).
 * Remove this route once the stuck-skeleton bug is diagnosed.
 */
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_session")?.value) {
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
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function DELETE() {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_session")?.value) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  clearHandshakeLogs();
  return NextResponse.json({ cleared: true });
}
