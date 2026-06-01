import { type NextRequest, NextResponse } from "next/server";

const WATCHED_PREFIXES = [
  "/assistant/__local/lockfile",
  "/assistant/__local/guardian-token",
  "/v1/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (WATCHED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    console.log(
      `[assistant-proxy] ${request.method} ${pathname} — ${new Date().toISOString()}`,
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/assistant/__local/:path*", "/v1/:path*"],
};
