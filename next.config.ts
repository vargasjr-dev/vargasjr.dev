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

  // proxy.ts preserves the site-wide trailing-slash convention for ordinary
  // page requests; skipTrailingSlashRedirect keeps Next/Vercel from emitting
  // a browser-visible 308 before the middleware redirect runs.
  trailingSlash: true,
  skipTrailingSlashRedirect: true,

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
