// The one place the product's name, words and colours are set. Every app,
// email and icon reads from here, so a rebrand is an edit to this file (and
// the mark in Logo.tsx), not a search through the codebase.

export const BRAND = {
  /** The product, as customers and shops see it. */
  name: "Stamply",
  /** The company behind it. Shown sparingly: footers, invoices, legal. */
  company: "TapTapSell",
  /** "Stamply by TapTapSell", for the places that carry the company too. */
  byline: "by TapTapSell",
  tagline: "Loyalty cards that live on your phone.",
  description:
    "Digital stamp cards for Pakistani shops. Customers tap their phone on a stamper at the counter: no app, no paper cards.",
} as const;

export const brandWithCompany = `${BRAND.name} ${BRAND.byline}`;

/**
 * Colour scales, 50 (lightest) to 950 (darkest). `brand` is the primary
 * colour: buttons, links, filled stamps. It must keep white text readable
 * from 500 up. `accent` is for small highlights such as rewards.
 *
 * Violet, after the purple ink of a rubber stamp pad.
 */
export const COLORS = {
  brand: {
    50: "#f5f3ff",
    100: "#ece7ff",
    200: "#dad0ff",
    300: "#bfaaff",
    400: "#9f7aff",
    500: "#6d3ff0",
    600: "#5b2ed6",
    700: "#4a23b0",
    800: "#3d1f8c",
    900: "#331c70",
    950: "#1f0f47",
  },
  accent: {
    50: "#fff8eb",
    100: "#ffedc6",
    200: "#ffd988",
    300: "#ffc14a",
    400: "#ffa920",
    500: "#f98a07",
    600: "#dd6502",
    700: "#b74606",
    800: "#94350c",
    900: "#7a2d0d",
    950: "#461402",
  },
} as const;

/** For places that cannot read CSS: browser chrome, PWA icons, emails. */
export const THEME_COLOR = COLORS.brand[600];
export const BACKGROUND_COLOR = "#f8fafc";
