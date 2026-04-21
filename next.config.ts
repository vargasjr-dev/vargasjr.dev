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
