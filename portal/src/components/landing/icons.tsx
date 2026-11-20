import type { ReactNode } from "react";
import { PETAL_ANGLES, PETAL_FACE, PETAL_SHADOW } from "@taptapsell/brand/logo";

// Icons for the landing pages. Line icons follow Lucide (https://lucide.dev, ISC licence).

/** The brand flower in one colour (the petal shadows a shade darker), for stamps and accents. */
export function Flower({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-940 -940 1880 1880" className={className} aria-hidden fill="currentColor">
      {PETAL_ANGLES.map((angle) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <path d={PETAL_FACE} />
          <path d={PETAL_SHADOW} opacity={0.72} />
        </g>
      ))}
    </svg>
  );
}

function Line({ children, className = "h-6 w-6" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

export const TapIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="3" y="5" width="10" height="16" rx="2" />
    <path d="M8 17h.01" />
    <path d="M16.5 9.5a4 4 0 0 1 0 5" />
    <path d="M19 7a7.5 7.5 0 0 1 0 10" />
  </Line>
);

export const StampIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13" />
    <path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z" />
    <path d="M5 22h14" />
  </Line>
);

export const GiftIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
  </Line>
);

export const PhoneIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M12 18h.01" />
  </Line>
);

export const CardsIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" />
    <path d="M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21" />
  </Line>
);

export const BellIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Line>
);

export const QrIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="3" y="3" width="5" height="5" rx="1" />
    <rect x="16" y="3" width="5" height="5" rx="1" />
    <rect x="3" y="16" width="5" height="5" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M3 12h.01" />
    <path d="M12 3h.01" />
    <path d="M12 16v.01" />
    <path d="M16 12h1" />
    <path d="M21 12v.01" />
    <path d="M12 21v-1" />
  </Line>
);

export const ShieldIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Line>
);

export const ChartIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </Line>
);

export const UsersIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Line>
);

export const ClockIcon = (p: IconProps) => (
  <Line {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Line>
);

export const WalletIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
  </Line>
);

export const ArrowIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <Line className={`${className} rtl:-scale-x-100`}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Line>
);

export const CheckIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Line>
);
