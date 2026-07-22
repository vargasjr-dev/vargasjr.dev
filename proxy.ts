import { type NextRequest, NextResponse } from "next/server";

const apiUrl = process.env.VELLUM_API_URL;
const GATEWAY_PREFIX = "/assistant/__gateway/7830";
const LOCAL_API_ROUTES = new Map([
  [`${GATEWAY_PREFIX}/auth/token`, "/api/vellum-local/gateway-token"],
  ["/v1/assistants", "/api/v1/assistants"],
  [
    "/v1/feature-flags/client-flag-values",
    "/api/v1/feature-flags/client-flag-values",
  ],
  ["/v1/user/consent", "/api/v1/user/consent"],
]);

const WATCHED_PREFIXES = [
  "/assistant/__local/lockfile",
  "/assistant/__local/guardian-token",
  "/v1/",
];

function withDaemonTrailingSlash(pathname: string): string {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function localApiPath(pathname: string): string | undefined {
  return LOCAL_API_ROUTES.get(pathname.replace(/\/$/, ""));
}

function isNonPagePath(pathname: string): boolean {
  const segment = pathname.split("/").at(-1) ?? "";
  return (
    segment.includes(".") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/api/")
  );
}

function isAssistantApiPath(pathname: string): boolean {
  return (
    pathname === "/v1" ||
    pathname.startsWith("/v1/") ||
    pathname.startsWith("/assistant/__local/") ||
    pathname.startsWith(`${GATEWAY_PREFIX}/`)
  );
}

const HEALTH_PATH =
  /^\/assistant\/__gateway\/7830\/v1\/assistants\/[^/]+\/healthz\/?$/;
const STATUS_PATH = /^\/assistant\/__local\/status\/[^/]+\/?$/;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Temporary web-local responses for the SPA's reachability probes. These
  // must run before the generic assistant routing below.
  if (STATUS_PATH.test(pathname)) {
    return NextResponse.json({ ok: true, state: "healthy" });
  }
  if (HEALTH_PATH.test(pathname)) {
    return NextResponse.json({ status: "ok" });
  }

  // skipTrailingSlashRedirect is global, so preserve the old site-wide
  // trailing-slash convention here for ordinary page requests. Assistant API
  // paths are intentionally excluded: they are normalized internally below.
  if (
    pathname !== "/" &&
    !pathname.endsWith("/") &&
    !isNonPagePath(pathname) &&
    !isAssistantApiPath(pathname)
  ) {
    return NextResponse.redirect(
      new URL(`${pathname}/${search}`, request.url),
      308,
    );
  }

  // Keep the app-owned mock routes in Next. The explicit rewrite target is
  // slashless so it maps to the App Router route without another redirect.
  const localPath = localApiPath(pathname);
  if (localPath) {
    return NextResponse.rewrite(new URL(`${localPath}${search}`, request.url));
  }

  // Everything else is a daemon API request. Normalize it internally so the
  // browser never observes a redirect from Next/Vercel.
  if (apiUrl && pathname.startsWith("/v1/")) {
    const daemonPath = withDaemonTrailingSlash(pathname);
    return NextResponse.rewrite(new URL(`${daemonPath}${search}`, apiUrl));
  }

  if (apiUrl && pathname.startsWith(`${GATEWAY_PREFIX}/`)) {
    const daemonPath = pathname.slice(GATEWAY_PREFIX.length);
    const normalizedPath = withDaemonTrailingSlash(daemonPath);
    return NextResponse.rewrite(new URL(`${normalizedPath}${search}`, apiUrl));
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
  // Include pages because skipTrailingSlashRedirect is global; ordinary page
  // requests still need the site's existing slashful canonical URL.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
