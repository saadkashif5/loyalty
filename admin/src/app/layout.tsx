import type { Metadata } from "next";
import { headers } from "next/headers";
import { BRAND } from "@taptapsell/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} Admin`, template: `%s · ${BRAND.name} Admin` },
  description: `Platform console for the ${BRAND.name} team.`,
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pages must render per request: a nonce cannot be baked into a static page.
  await headers();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
