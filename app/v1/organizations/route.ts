import { NextResponse } from "next/server";

/**
 * In self-hosted mode, the daemon doesn't have a /v1/organizations endpoint.
 * The SPA calls this on startup and requires at least one result — if the
 * org store gets an empty array, it sets status:'error' and the UI gates
 * behind it, staying stuck on "Connecting...".
 *
 * Return a synthetic local org so the store transitions to status:'ready'
 * and the SPA proceeds to load conversations.
 */
export async function GET() {
  return NextResponse.json({
    count: 1,
    results: [
      {
        id: "local",
        name: "Local",
        slug: "local",
      },
    ],
  });
}
