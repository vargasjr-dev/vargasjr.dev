import { type NextRequest, NextResponse } from "next/server";

const apiUrl = process.env.VELLUM_API_URL;

const WATCHED_PREFIXES = [
  "/assistant/__local/lockfile",
  "/assistant/__local/guardian-token",
  "/v1/",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // DEBUG: Log that proxy ran
  console.error(`[proxy-debug] ENTERED: ${request.method} ${pathname}${search}`);

  // Proxy /v1/* and /assistant/__gateway/7830/v1/* directly to the daemon so
  // the original path (including trailing slashes) is forwarded as-is. The
  // SPA's SDK is FastAPI-generated and emits paths like `/v1/assistants/` and
  // `/v1/feature-flags/client-flag-values/` with literal trailing slashes,
  // but Next.js's default `trailingSlash: false` 308-redirects those to the
  // slash-stripped form before any rewrite rule fires — and the daemon
  // returns 404 for the un-slashed path because the route is registered with
  // the trailing slash. Proxying here keeps the slash intact and avoids the
  // 308 entirely.
  //
  // The /assistant/__gateway/7830/auth/token path is intentionally NOT
  // matched here (no `/v1/` after the gateway prefix); it falls through to
  // the rewrite rule in next.config.ts which maps it to the internal
  // /api/vellum-local/gateway-token route.
  if (apiUrl) {
    if (pathname.startsWith("/v1/")) {
      console.error(`[proxy-debug] REWRITING /v1/* to daemon: ${pathname}${search}`);
      const daemonUrl = new URL(pathname + search, apiUrl).toString();
      return NextResponse.rewrite(daemonUrl);
    }
    if (pathname.startsWith("/assistant/__gateway/7830/v1/")) {
      const restPath = pathname.slice("/assistant/__gateway/7830".length);
      console.error(`[proxy-debug] REWRITING gateway to daemon: ${restPath}${search}`);
      const daemonUrl = new URL(restPath + search, apiUrl).toString();
      return NextResponse.rewrite(daemonUrl);
    }
  }

  if (WATCHED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const authHeader = request.headers.get("authorization");
    const authSummary = authHeader
      ? `auth=${authHeader.slice(0, 12)}...`
      : "NO AUTH HEADER";
    console.log(
      `[assistant-proxy] ${request.method} ${pathname} — ${authSummary} — ${new Date().toISOString()}`,
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/assistant/__local/:path*",
    "/assistant/__gateway/:path*",
    "/v1/:path*",
  ],
};