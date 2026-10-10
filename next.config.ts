import type { NextConfig } from "next";

// The admin shell ships BOTH SPA bundles side by side (@mycadet/web +
// @vellumai/web — see scripts/copy-assistant.ts) and can swap between them
// at runtime. The active bundle rides in the `webClientBundle` cookie
// (mirrored from the SPA's localStorage key; proxy.ts also resolves it into
// the x-web-client-bundle request header for the shell route). Each bundle
// dir keeps its own near-copy of the local API, so every SPA-facing local
// rewrite comes in a PAIR: the vellum variant fires only when the cookie
// says vellum, and the cadet default follows it.
function localApiRewrite(source: string, destination: string) {
  return [
    {
      source,
      destination: `/api/vellum-local/${destination}`,
      has: [
        { type: "cookie" as const, key: "webClientBundle", value: "vellum" },
      ],
    },
    { source, destination: `/api/cadet-local/${destination}` },
  ];
}

const nextConfig: NextConfig = {
  // Compress responses
  compress: true,

  // Strict mode for catching bugs
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Let proxy.ts normalize assistant API paths internally. Without this,
  // Next/Vercel emits a browser-visible 308 before the API rewrite runs.
  // proxy.ts preserves the trailing-slash convention for normal pages.
  trailingSlash: true,
  skipTrailingSlashRedirect: true,

  // Proxy Vellum assistant API calls to the daemon.
  // Set VELLUM_API_URL to the base URL of your Vellum backend (e.g. the
  // ngrok tunnel or local address where the Vellum daemon is running).
  async rewrites() {
    const apiUrl = process.env.VELLUM_API_URL;
    const external = apiUrl
      ? [
          { source: "/v1/:path*", destination: `${apiUrl}/v1/:path*` },
          {
            source: "/_allauth/:path*",
            destination: `${apiUrl}/_allauth/:path*`,
          },
          {
            source: "/accounts/:path*",
            destination: `${apiUrl}/accounts/:path*`,
          },
        ]
      : [];

    // Next.js treats __ folders as private (excluded from routing), so we
    // map the SPA's __local paths to our real API routes via internal rewrites.
    return {
      // These two SPA probes must run before filesystem routes and the generic
      // gateway proxy. Otherwise the /assistant catch-all or gateway rewrite
      // can win intermittently and send health traffic to the assistant.
      beforeFiles: [
        ...localApiRewrite(
          "/assistant/__local/status/:assistantId",
          "status/:assistantId",
        ),
        ...localApiRewrite(
          "/assistant/__gateway/7830/v1/assistants/:assistantId/healthz",
          "healthz/:assistantId",
        ),
      ],
      afterFiles: [
        // Short-circuit mocks for endpoints the SPA fires early in its bootstrap
        // that the daemon doesn't implement (or that 404 and break local-mode
        // startup). These must come BEFORE the generic `/v1/:path*` rewrite so
        // they take precedence.
        //
        // See app/api/v1/feature-flags/client-flag-values/route.ts for rationale.
        {
          source: "/v1/feature-flags/client-flag-values/",
          destination: "/api/v1/feature-flags/client-flag-values",
        },
        // See app/api/v1/assistants/route.ts for rationale.
        {
          source: "/v1/assistants/",
          destination: "/api/v1/assistants",
        },
        // See app/api/v1/user/consent/route.ts for rationale.
        {
          source: "/v1/user/consent/",
          destination: "/api/v1/user/consent",
        },
        ...external,
        ...localApiRewrite("/assistant/__local/lockfile", "lockfile"),
        ...localApiRewrite(
          "/assistant/__local/guardian-token/:assistantId",
          "guardian-token/:assistantId",
        ),
        // Local assistant status check — SPA's auth-store fires
        // `re(assistantId)` (= `ts(e)` in local-mode.js) to determine if the
        // local host is reachable. See the status route in
        // app/api/{vellum,cadet}-local/status/[assistantId]/route.ts.
        ...localApiRewrite(
          "/assistant/__local/status/:assistantId",
          "status/:assistantId",
        ),
        // Temporary web-local health short-circuit. Keep this before the generic
        // gateway proxy so the heartbeat does not reach the assistant backend.
        // TODO: Remove when the upstream Vellum heartbeat is made efficient.
        ...localApiRewrite(
          "/assistant/__gateway/7830/v1/assistants/:assistantId/healthz",
          "healthz/:assistantId",
        ),
        // P() connect flow: gateway token exchange.
        // gatewayPort=7830 → URL = /assistant/__gateway/7830/auth/token.
        // 0.10.x requires numeric gatewayPort; see comment in lockfile route.
        ...localApiRewrite(
          "/assistant/__gateway/7830/auth/token",
          "gateway-token",
        ),
        // After the connect succeeds, b.url = origin + /assistant/__gateway/7830.
        // The SPA's fetch interceptor prefixes ALL SDK calls with b.url, so every
        // API call becomes /assistant/__gateway/7830/v1/... — proxy them to ngrok.
        ...(apiUrl
          ? [
              {
                source: "/assistant/__gateway/7830/:path*",
                destination: `${apiUrl}/:path*`,
              },
            ]
          : []),
      ],
    };
  },

  // Bundle analyzer in dev (opt-in via ANALYZE=true)
  ...(process.env.ANALYZE === "true"
    ? {
        experimental: {
          webpackBuildWorker: true,
        },
      }
    : {}),
};

export default nextConfig;
