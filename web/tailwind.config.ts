import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f3",
          500: "#0f766e",
          600: "#0d635c",
          700: "#0a4f49",
        },
      },
    },
  },
  plugins: [],
};

export default config;
