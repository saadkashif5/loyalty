import { BRAND, COLORS } from "./index";

// The logo. To use the design team's mark, replace the <svg> in LogoMark
// with theirs (keep `size` driving its width and height). Everything that
// shows the logo, including the home-screen icon, goes through LogoMark.
//
// Stamper glyph: Lucide "stamp" icon (ISC licence), https://lucide.dev/icons/stamp

/**
 * The square mark on its own. Styled inline, not with classes, so it also
 * renders in generated images (next/og), which cannot read stylesheets.
 */
export function LogoMark({
  size = 32,
  title,
  square = false,
}: {
  size?: number;
  title?: string;
  /** Full-bleed corners, for app icons that the phone crops itself. */
  square?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="stamply-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={COLORS.brand[500]} />
          <stop offset="1" stopColor={COLORS.brand[700]} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={square ? 0 : 8} fill="url(#stamply-mark)" />
      <g
        transform="translate(6 6) scale(0.8333)"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13" />
        <path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z" />
        <path d="M5 22h14" stroke={COLORS.accent[300]} />
      </g>
    </svg>
  );
}

const SIZES = {
  sm: { mark: 24, text: "text-base" },
  md: { mark: 32, text: "text-xl" },
  lg: { mark: 44, text: "text-3xl" },
} as const;

/** Mark and name together. `tone="light"` is for dark backgrounds. */
export function Logo({
  size = "md",
  tone = "dark",
  suffix,
  byline = false,
  className = "",
}: {
  size?: keyof typeof SIZES;
  tone?: "dark" | "light";
  /** A product area after the name, e.g. "Admin" or "Business". */
  suffix?: string;
  /** Adds "by TapTapSell" under the name. */
  byline?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {tone === "light" ? (
        // A violet tile on a violet panel needs an edge to stand out.
        <span className="inline-flex rounded-[25%] ring-2 ring-white/30">
          <LogoMark size={s.mark} />
        </span>
      ) : (
        <LogoMark size={s.mark} />
      )}
      <span className="flex flex-col leading-none">
        <span
          className={`${s.text} font-bold tracking-tight ${tone === "light" ? "text-white" : "text-slate-900"}`}
        >
          {BRAND.name}
          {suffix ? (
            <span
              className={`ml-1.5 font-medium ${tone === "light" ? "text-brand-200" : "text-brand-600"}`}
            >
              {suffix}
            </span>
          ) : null}
        </span>
        {byline ? (
          <span
            className={`mt-1 text-[0.7rem] font-medium ${tone === "light" ? "text-brand-200" : "text-slate-500"}`}
          >
            {BRAND.byline}
          </span>
        ) : null}
      </span>
    </span>
  );
}
