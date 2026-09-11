import { NextResponse } from "next/server";
import { db } from "@/db";
import { gmailConnection } from "@/db/schema";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db.select().from(gmailConnection).limit(1);
  const conn = rows[0];
  return NextResponse.json({
    connected: !!conn,
    email: conn?.email ?? null,
    scope: conn?.scope ?? null,
    expiresAt: conn?.expiresAt ?? null,
  });
}
