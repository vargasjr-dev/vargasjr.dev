import { NextResponse } from "next/server";
import { db } from "@/db";
import { gmailConnection } from "@/db/schema";
import { decryptToken, getValidAccessToken } from "@/lib/gmail-auth";

export const maxDuration = 60;

/** Temporary diagnostic for the /api/gmail/filters 502. Reports which leg
 *  of the token pipeline dies. Remove once the crash is pinned. */
export async function GET(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const steps: Record<string, string> = {};
  try {
    const rows = await db.select().from(gmailConnection).limit(1);
    steps["db-select"] = "ok";
    const conn = rows[0];
    steps["row"] = conn
      ? `expiresAt=${conn.expiresAt.toISOString()} refreshToken=${conn.refreshToken ? "present" : "null"} accessTokenLen=${conn.accessToken?.length}`
      : "no row";
    if (conn) {
      try {
        const at = decryptToken(conn.accessToken);
        steps["decrypt-access"] = `ok len=${at.length}`;
      } catch (e) {
        steps["decrypt-access"] = `THREW: ${e instanceof Error ? e.message : String(e)}`;
      }
      try {
        const t = await getValidAccessToken();
        steps["get-valid-token"] = `ok len=${t.length}`;
      } catch (e) {
        steps["get-valid-token"] = `THREW: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    return NextResponse.json({ steps });
  } catch (e) {
    return NextResponse.json(
      { steps, fatal: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
