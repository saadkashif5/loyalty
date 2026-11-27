// Class names for the building blocks every app shares (cards, buttons, form
// controls, tables, badges), so the dashboard, the admin console and the
// customer portal look like one product. Each app's components/ui.tsx wraps
// these; change a look here and it changes everywhere.
//
// Colour rules from the brand board ("Fresh Ink"):
// - Stamp Orange (brand-500) is for the logo, stamps and accents. White text on
//   it only passes contrast at large bold sizes, so solid buttons use Ember
//   (brand-600) and darken to brand-700 when pressed.
// - Midnight Ink (ink) is for text and dark surfaces; Steam (ink-400) for
//   secondary text; Crema for page backgrounds.
// - Mint is success and earned rewards; Honey (accent) is highlights and
//   warnings; red stays for errors and destructive actions.

const FOCUS = "focus-visible:outline-none focus-visible:ring-4";

export const UI = {
  card: "rounded-2xl border border-ink/[0.07] bg-white p-5 shadow-[0_1px_2px_rgb(var(--ink-900)/0.04),0_12px_32px_-20px_rgb(var(--ink-900)/0.22)]",

  pageTitle: "font-display text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]",
  pageDescription: "mt-1 text-sm text-ink-500",
  sectionTitle: "font-display text-lg font-bold tracking-tight text-ink",

  statLabel:
    "flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400",
  statDot: "h-1.5 w-1.5 rounded-full bg-brand-500",
  statValue: "mt-2 font-display text-3xl font-bold tabular-nums tracking-tight text-ink",
  statHint: "mt-1 text-xs text-ink-400",

  buttonBase: `inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${FOCUS}`,
  buttonPrimary:
    "bg-brand-600 text-white shadow-[0_8px_20px_-10px_rgb(var(--brand-600)/0.9)] hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-500/30",
  buttonSecondary:
    "border border-ink/15 bg-white text-ink-800 hover:border-ink/30 hover:bg-crema-50 focus-visible:ring-ink/10",
  buttonDanger:
    "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 focus-visible:ring-red-500/20",
  buttonInk: "bg-ink text-crema hover:bg-ink-700 focus-visible:ring-ink/20",

  label: "mb-1.5 block text-sm font-medium text-ink-700",
  control:
    "w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-300 hover:border-ink/25 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-ink-50 disabled:text-ink-400",
  errorText: "text-sm text-red-600",
  savedText: "text-sm font-medium text-mint-700",

  emptyState: "text-center text-sm text-ink-500",

  tableWrap:
    "overflow-x-auto rounded-2xl border border-ink/[0.07] bg-white shadow-[0_1px_2px_rgb(var(--ink-900)/0.04)]",
  table: "w-full text-left text-sm",
  tableHead:
    "border-b border-ink/[0.07] bg-crema-50 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400",
  tableHeadCell: "px-4 py-3 font-semibold",
  tableBody: "divide-y divide-ink/[0.06]",
  tableRow: "transition-colors hover:bg-crema-50",
  tableCell: "px-4 py-3 align-top",

  badge:
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",

  pager: "mt-5 flex items-center justify-between text-sm text-ink-500",
  pagerLink:
    "rounded-full border border-ink/15 bg-white px-3.5 py-1.5 font-medium text-ink-700 transition hover:border-ink/30",
} as const;

/** Badge colours by meaning; StatusBadge maps each status onto one of these. */
export const TONES = {
  success: "bg-mint-50 text-mint-800 ring-1 ring-inset ring-mint-500/25",
  warning: "bg-accent-50 text-accent-800 ring-1 ring-inset ring-accent-300/50",
  danger: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-500/20",
  info: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-500/20",
  neutral: "bg-ink-50 text-ink-600 ring-1 ring-inset ring-ink/10",
} as const;

export type Tone = keyof typeof TONES;

/** Which tone each status in the system reads as. Unknown statuses are neutral. */
export const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  ACCEPTED: "success",
  APPROVED: "success",
  CONVERTED: "success",
  PAID: "success",
  REDEEMED: "success",
  PENDING: "warning",
  INVITED: "warning",
  ISSUED: "warning",
  OPEN: "warning",
  PAST_DUE: "warning",
  ASSIGNED: "info",
  CONTACTED: "info",
  NEW: "info",
  TRIALING: "info",
  CONFIRMED: "danger",
  REJECTED: "danger",
  REVOKED: "danger",
  SUSPENDED: "danger",
};

export function statusClass(status: string): string {
  return `${UI.badge} ${TONES[STATUS_TONE[status] ?? "neutral"]}`;
}

/** "PAST_DUE" → "Past due". */
export function statusLabel(status: string): string {
  const words = status.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
