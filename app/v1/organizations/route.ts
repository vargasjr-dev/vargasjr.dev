import { NextResponse } from "next/server";

/**
 * In self-hosted mode, the daemon doesn't have a /v1/organizations endpoint.
 * The SPA calls this on startup to populate the org selector. We intercept it
 * here (before the ngrok proxy rewrite) and return an empty result so the SPA
 * can continue loading without hanging.
 */
export async function GET() {
  return NextResponse.json({ count: 0, results: [] });
}
