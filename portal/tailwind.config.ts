import type { Config } from "tailwindcss";
import brand, { brandContent } from "@taptapsell/brand/tailwind";

// Colours, logo and name come from packages/brand.
const config: Config = {
  presets: [brand],
  content: ["./src/**/*.{ts,tsx}", brandContent],
  plugins: [],
};

export default config;
