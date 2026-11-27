import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { headers } from "next/headers";
import { BRAND } from "@taptapsell/brand";
import "./globals.css";

// The brand board's typefaces, self-hosted by Next. The Tailwind preset reads
// these variables as `font-display` (and every h1-h3) and `font-sans`.
const display = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} Admin`, template: `%s · ${BRAND.name} Admin` },
  description: `Platform console for the ${BRAND.name} team.`,
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pages must render per request: a nonce cannot be baked into a static page.
  await headers();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
