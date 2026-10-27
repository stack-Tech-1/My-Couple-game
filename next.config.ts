import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The share poster draws text with these (read from disk at request time).
  outputFileTracingIncludes: { "/room/[roomId]/poster": ["./assets/fonts/*.ttf"] },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [
      // The service worker must always be revalidated so updates roll out promptly.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      // Font files are versioned by name (-v1), so they can be cached forever.
      { source: "/fonts/:file*.woff2", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;