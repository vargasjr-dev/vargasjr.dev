import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logHandshake } from "@/lib/handshake-log";

/**
 * Gateway token exchange endpoint.
 *
 * The SPA's connect flow calls:
 *   POST /assistant/__gateway/7830/auth/token
 *     Authorization: Bearer <guardianToken>
 *
 * which is rewritten here. We return the Vellum access token as the
 * "gateway token" so the SPA caches it via de() and subsequent API calls
 * carry Authorization: Bearer <token>.
 *
 * (0.10.x requires numeric gatewayPort in the lockfile, so the path is
 * /assistant/__gateway/7830/... instead of /assistant/__gateway/self-hosted/...)
 */
export async function POST() {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_session")?.value) {
    logHandshake({
      route: "gateway-token",
      method: "POST",
      status: 401,
      detail: "no admin_session cookie",
    });
    return new NextResponse(null, { status: 401 });
  }

  const token = process.env.VELLUM_ACCESS_TOKEN;
  if (!token) {
    logHandshake({
      route: "gateway-token",
      method: "POST",
      status: 404,
      detail: "VELLUM_ACCESS_TOKEN not set",
    });
    return new NextResponse(null, { status: 404 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 7200;
  logHandshake({
    route: "gateway-token",
    method: "POST",
    status: 200,
    detail: `tokenPresent=true expiresAt=${expiresAt}`,
  });
  return NextResponse.json({
    token,
    // 2-hour TTL — keeps the cached gateway token alive for a full session
    expiresAt,
  });
}
