import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker builds set NEXT_OUTPUT=standalone (see Dockerfile); local dev is unchanged.
  ...(process.env.NEXT_OUTPUT === "standalone" && {
    output: "standalone",
    // The monorepo root, so the shared workspace packages are traced into the build.
    outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
  }),
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship as TypeScript source, so Next must compile them.
  transpilePackages: [
    "@taptapsell/brand",
    "@taptapsell/constants",
    "@taptapsell/types",
    "@taptapsell/validation",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The console must never be framed or indexed.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
