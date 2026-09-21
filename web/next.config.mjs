/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship as TypeScript source, so Next must compile them.
  transpilePackages: ["@taptapsell/constants", "@taptapsell/types", "@taptapsell/validation"],
};

export default nextConfig;
