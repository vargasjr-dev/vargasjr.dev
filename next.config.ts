import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses
  compress: true,

  // Strict mode for catching bugs
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
  },

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
    return [
      ...external,
      {
        source: "/assistant/__local/lockfile",
        destination: "/api/vellum-local/lockfile",
      },
      {
        source: "/assistant/__local/guardian-token/:assistantId",
        destination: "/api/vellum-local/guardian-token/:assistantId",
      },
    ];
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
