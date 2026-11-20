import { BRAND, PALETTE } from "./index";

// The logo: a six-petal flower (Stamp Orange, with an Ember shadow down one
// side of each petal) and the lowercase wordmark in Outfit Bold. The artwork
// it is traced from is in packages/brand/assets. Everything that shows the
// logo, including the home-screen icon, goes through LogoMark.

export const PETAL_ANGLES = [0, 60, 120, 180, 240, 300] as const;

/** One petal pointing up from the centre, in a 2000-unit box centred on 0,0. */
export const PETAL_FACE = "M0-35C-262-262-252-700 0-877C100-640 100-280 0-35Z";
export const PETAL_SHADOW = "M0-877C206-720 236-330 0-35C100-280 100-640 0-877Z";

/**
 * The flower on its own. Styled inline, not with classes, so it also renders
 * in generated images (next/og), which cannot read stylesheets. Drawn without
 * <defs>/<use> for the same reason.
 */
export function LogoMark({
  size = 32,
  title,
  square = false,
}: {
  size?: number;
  title?: string;
  /** On a full-bleed Crema tile, for app icons that the phone crops itself. */
  square?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={square ? "-1250 -1250 2500 2500" : "-940 -940 1880 1880"}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0 }}
    >
      {square ? <rect x="-1250" y="-1250" width="2500" height="2500" fill={PALETTE.crema} /> : null}
      {PETAL_ANGLES.map((angle) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <path d={PETAL_FACE} fill={PALETTE.stampOrange} />
          <path d={PETAL_SHADOW} fill={PALETTE.ember} />
        </g>
      ))}
    </svg>
  );
}

const SIZES = {
  sm: { mark: 22, text: "text-xl" },
  md: { mark: 28, text: "text-2xl" },
  lg: { mark: 40, text: "text-4xl" },
} as const;

/** Mark and wordmark together. `tone="light"` is for dark backgrounds. */
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
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={s.mark} />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display ${s.text} font-bold tracking-tight ${tone === "light" ? "text-white" : "text-ink"}`}
        >
          {/* The wordmark is set lowercase. */}
          {BRAND.name.toLowerCase()}
          {suffix ? (
            <span
              className={`ml-1.5 font-semibold ${tone === "light" ? "text-brand-300" : "text-brand-600"}`}
            >
              {suffix}
            </span>
          ) : null}
        </span>
        {byline ? (
          <span
            className={`mt-1 font-sans text-[0.7rem] font-medium ${tone === "light" ? "text-ink-300" : "text-steam"}`}
          >
            {BRAND.byline}
          </span>
        ) : null}
      </span>
    </span>
  );
}
