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

/**
 * Resolves the active SPA bundle for this request. Both admin shells ship
 * side by side (@mycadet/web + @vellumai/web — see scripts/copy-assistant.ts)
 * and the browser carries the choice as the `webClientBundle` cookie, a
 * mirror of the SPA's `webClientBundle` localStorage key. An explicitly set
 * `x-web-client-bundle` header wins (so server-side callers can override);
 * otherwise the cookie decides. Cadet is the default.
 */
function webClientBundle(request: NextRequest): "cadet" | "vellum" {
  const header = request.headers.get("x-web-client-bundle");
  if (header === "cadet" || header === "vellum") return header;
  return request.cookies.get("webClientBundle")?.value === "vellum"
    ? "vellum"
    : "cadet";
}

// Bundle-aware dispatch for the local API: each SPA dist ships its own copy
// of the near-identical endpoints (app/api/vellum-local + app/api/cadet-local),
// so gateway-token exchange resolves to whichever bundle's API it belongs to.
// Shared /v1 mocks are left untouched — both bundles use them identically.
function bundleLocalPath(
  localPath: string,
  bundle: "cadet" | "vellum",
): string {
  if (localPath.startsWith("/api/vellum-local/") && bundle === "cadet") {
    return localPath.replace("/api/vellum-local/", "/api/cadet-local/");
  }
  return localPath;
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
const ALLAUTH_SESSION_PATH = /^\/_allauth\/browser\/v1\/auth\/session\/?$/;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const bundle = webClientBundle(request);

  // Temporary web-local responses for the SPA's reachability probes. These
  // must run before the generic assistant routing below.
  if (STATUS_PATH.test(pathname)) {
    return NextResponse.json({ ok: true, state: "healthy" });
  }
  if (HEALTH_PATH.test(pathname)) {
    return NextResponse.json({ status: "ok" });
  }
  if (ALLAUTH_SESSION_PATH.test(pathname)) {
    // The web-hosted local assistant has no platform Allauth session. Return
    // the unauthenticated shape locally instead of redirecting or contacting
    // the Vellum backend.
    return NextResponse.json({ data: null });
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
    return NextResponse.rewrite(
      new URL(`${bundleLocalPath(localPath, bundle)}${search}`, request.url),
    );
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

  // Resolve the active SPA bundle into a request header so the /assistant
  // shell route (and anything else server-side) can pick which bundle to
  // serve without re-parsing cookies.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-web-client-bundle", bundle);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Include pages because skipTrailingSlashRedirect is global; ordinary page
  // requests still need the site's existing slashful canonical URL.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
