import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { headers } from "next/headers";
import { BRAND, THEME_COLOR } from "@taptapsell/brand";
import "./globals.css";
import { getLocale } from "@/lib/i18n";

// The brand board's typefaces, self-hosted by Next (no request goes to Google).
// The Tailwind preset reads these variables as `font-display` and `font-sans`.
const display = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: `Your loyalty cards from every ${BRAND.name} shop, in one place.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: THEME_COLOR,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pages must render per request: a nonce cannot be baked into a static page.
  await headers();
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={locale === "ur" ? "rtl" : "ltr"}
      className={`${display.variable} ${body.variable}`}
    >
      <body className="min-h-screen bg-slate-50 font-sans">{children}</body>
    </html>
  );
}
