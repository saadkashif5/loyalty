import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TapTapSell Loyalty",
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
