/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship as TypeScript source, so Next must compile them.
  transpilePackages: ["@taptapsell/constants", "@taptapsell/types", "@taptapsell/validation"],
  // Payment receipts (up to 5 MB) are uploaded through a Server Action.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
