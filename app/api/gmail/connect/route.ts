import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/gmail-auth";

function isAdmin(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  if (cookie.includes("admin_session=1")) return true;
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.ADMIN_TOKEN;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The client_id only has the production redirect registered; fall back to it
  // when the page is visited from a non-production origin.
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://vargasjr.dev";
  const redirectUri = `${origin}/api/gmail/callback`;

  // CSRF protection: state is stored in a cookie and checked by the callback.
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
  res.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return res;
}
