import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/feed";
const wsOrigin = new URL(wsUrl).origin;

// Content Security Policy. Inline scripts are required by Next.js runtime bootstrapping.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Link-preview thumbnails come from arbitrary https sites.
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${wsOrigin}${isDev ? " ws://localhost:3000" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Static brand assets rarely change; let browsers and CDNs cache them.
      {
        source: "/logos/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
  // The browser only talks to this origin; API and media are proxied to the Python
  // backend, which keeps the session cookie first-party (SameSite) and avoids CORS.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/media/:path*", destination: `${backendUrl}/media/:path*` },
    ];
  },
};

export default nextConfig;
