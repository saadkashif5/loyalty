// The one place the product's name, words and colours are set. Every app,
// email and icon reads from here, so a rebrand is an edit to this file (and
// the mark in Logo.tsx), not a search through the codebase.

export const BRAND = {
  /** The product, as customers and shops see it. */
  name: "Stamply",
  /** The company behind it. Shown sparingly: footers, invoices, legal. */
  company: "TapTapSell",
  /** The company's own site. "by TapTapSell" links here. */
  companyUrl: "https://taptapsell.pk",
  /** "Stamply by TapTapSell", for the places that carry the company too. */
  byline: "by TapTapSell",
  tagline: "Loyalty cards that live on your phone.",
  description:
    "Digital stamp cards for Pakistani shops. Customers tap their phone on a stamper at the counter: no app, no paper cards.",
} as const;

export const brandWithCompany = `${BRAND.name} ${BRAND.byline}`;

/**
 * Where each app is served in production. Runtime links are built from each
 * app's environment (DASHBOARD_URL, ADMIN_URL, API_BASE_URL), not from here;
 * this is the reference those values must match. The portal host is written
 * onto every stamper tag, so it cannot change once tags are in the field.
 */
export const PRODUCTION_HOSTS = {
  /** Customer portal, home page and /business pages; stamper taps land here. */
  portal: "stamply.taptapsell.pk",
  /** Business dashboard (`web/`). */
  dashboard: "business.stamply.taptapsell.pk",
  /** Platform console (`admin/`). */
  admin: "admin.stamply.taptapsell.pk",
  /** REST API. */
  api: "api.stamply.taptapsell.pk",
} as const;

/**
 * The seven colours on the brand board ("Fresh Ink"). Everything below is
 * built from these; use the scales in code, these names when talking about it.
 */
export const PALETTE = {
  /** Primary: logo, buttons, stamps. */
  stampOrange: "#FF5A1F",
  /** Petal shadow, pressed states. */
  ember: "#D63A0A",
  /** Text and dark surfaces, the stamper body. */
  midnightInk: "#151A33",
  /** Backgrounds. */
  crema: "#FFF6EA",
  /** Reward earned, success. */
  mintReward: "#2ED3A6",
  /** Highlights, streaks. */
  honey: "#FFC24B",
  /** Secondary text, borders. */
  steam: "#8A90A6",
} as const;

/**
 * Colour scales, 50 (lightest) to 950 (darkest), each a Tailwind colour
 * (`bg-brand-500`, `text-ink`, `bg-crema`). `DEFAULT` is the board colour.
 *
 * - `brand`: Stamp Orange at 500, Ember at 600. White text on 500 only passes
 *   for large or bold type (3:1), so solid buttons use 600 and up.
 * - `accent`: Honey, for highlights and streaks.
 * - `ink`: Midnight Ink at 900 (text, dark surfaces), Steam at 400.
 * - `crema`, `mint`, `steam`: backgrounds, rewards, secondary text.
 */
export const COLORS = {
  brand: {
    DEFAULT: PALETTE.stampOrange,
    50: "#fff4ee",
    100: "#ffe4d5",
    200: "#ffc6a8",
    300: "#ff9f72",
    400: "#ff7a45",
    500: PALETTE.stampOrange,
    600: PALETTE.ember,
    700: "#b02e08",
    800: "#8c260b",
    900: "#72220e",
    950: "#3e0e03",
  },
  accent: {
    DEFAULT: PALETTE.honey,
    50: "#fffaeb",
    100: "#fff0cc",
    200: "#ffe199",
    300: PALETTE.honey,
    400: "#ffb22e",
    500: "#f59b0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
    950: "#451a03",
  },
  ink: {
    DEFAULT: PALETTE.midnightInk,
    50: "#f4f5f8",
    100: "#e6e8ef",
    200: "#cdd0dd",
    300: "#aab0c3",
    400: PALETTE.steam,
    500: "#656c87",
    600: "#4a516c",
    700: "#343a56",
    800: "#232943",
    900: PALETTE.midnightInk,
    950: "#0b0e1e",
  },
  crema: {
    DEFAULT: PALETTE.crema,
    50: "#fffcf7",
    100: PALETTE.crema,
    200: "#fcebd4",
    300: "#f6dbb7",
  },
  mint: {
    DEFAULT: PALETTE.mintReward,
    50: "#ebfbf6",
    100: "#cbf5e9",
    200: "#97ebd3",
    500: PALETTE.mintReward,
    600: "#1fae88",
    700: "#178a6c",
    800: "#126c55",
  },
  steam: {
    DEFAULT: PALETTE.steam,
  },
} as const;

/** The two typefaces on the board. Each app loads them (next/font) into these CSS variables. */
export const FONTS = {
  /** Headlines and the wordmark. */
  display: { family: "Outfit", variable: "--font-display" },
  /** Body text. */
  body: { family: "Inter", variable: "--font-body" },
} as const;

/** For places that cannot read CSS: browser chrome, PWA icons, emails. */
export const THEME_COLOR = PALETTE.stampOrange;
export const BACKGROUND_COLOR = PALETTE.crema;
