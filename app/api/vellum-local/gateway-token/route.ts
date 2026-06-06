import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Gateway token exchange endpoint.
 *
 * The SPA's P() connect flow calls:
 *   POST /assistant/__gateway/self-hosted/auth/token
 *     Authorization: Bearer <guardianToken>
 *
 * which is rewritten here. We return the Vellum access token as the
 * "gateway token" so the SPA caches it via h() and subsequent API calls
 * carry Authorization: Bearer <token>.
 */
export async function POST() {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_session")?.value) {
    return new NextResponse(null, { status: 401 });
  }

  const token = process.env.VELLUM_ACCESS_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });

  return NextResponse.json({
    token,
    // 2-hour TTL — keeps the cached gateway token alive for a full session
    expiresAt: Math.floor(Date.now() / 1000) + 7200,
  });
}
