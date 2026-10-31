/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship as TypeScript source, so Next must compile them.
  transpilePackages: ["@taptapsell/constants", "@taptapsell/types", "@taptapsell/validation"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The console must never be framed or indexed.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
