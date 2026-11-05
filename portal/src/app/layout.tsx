import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { getLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "TapTapSell",
  description: "Your loyalty cards from every TapTapSell shop, in one place.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pages must render per request: a nonce cannot be baked into a static page.
  await headers();
  const locale = await getLocale();
  return (
    <html lang={locale} dir={locale === "ur" ? "rtl" : "ltr"}>
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
