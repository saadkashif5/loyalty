import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { COLORS, FONTS } from "./src/index";

// Shared by every app's tailwind.config.ts. The colours become CSS variables
// (--brand-500: 255 90 31), so `bg-brand-500/20` and friends work, and a
// page can be re-themed at runtime by overriding the variables.

type Scale = Record<string, string>;

function channels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const variables: Record<string, string> = {};
const colors: Record<string, Scale> = {};
for (const [name, scale] of Object.entries(COLORS) as Array<[string, Scale]>) {
  colors[name] = {};
  for (const [step, hex] of Object.entries(scale)) {
    variables[`--${name}-${step}`] = channels(hex);
    colors[name][step] = `rgb(var(--${name}-${step}) / <alpha-value>)`;
  }
}

// An app that has not loaded the brand fonts falls back to the system font
// inside var(), so the declaration never becomes invalid.
const SYSTEM = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: [`var(${FONTS.body.variable}, ${SYSTEM})`, SYSTEM],
        display: [`var(${FONTS.display.variable}, ${SYSTEM})`, SYSTEM],
      },
    },
  },
  plugins: [
    plugin(({ addBase }) =>
      addBase({
        ":root": variables,
        // Headlines are Outfit everywhere; body text stays Inter.
        "h1, h2, h3": {
          fontFamily: `var(${FONTS.display.variable}, ${SYSTEM})`,
          letterSpacing: "-0.015em",
        },
        "::selection": { backgroundColor: "rgb(var(--brand-500) / 0.25)", color: "inherit" },
        ":focus-visible": { outlineColor: "rgb(var(--brand-500))" },
      }),
    ),
  ],
};

export default preset;

/** Where the shared components live, for each app's `content` list. */
export const brandContent = "../packages/brand/src/**/*.{ts,tsx}";
