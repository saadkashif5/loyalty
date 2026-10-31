import type { Config } from "tailwindcss";

// Indigo rather than the dashboard's teal, so the team can tell at a glance
// that they are in the platform console.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          500: "#4f46e5",
          600: "#4338ca",
          700: "#3730a3",
        },
      },
    },
  },
  plugins: [],
};

export default config;
