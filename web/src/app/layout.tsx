import type { Metadata } from "next";
import { headers } from "next/headers";
import { BRAND } from "@taptapsell/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} Business`, template: `%s · ${BRAND.name} Business` },
  description: "Manage your loyalty programs, stampers and rewards.",
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
