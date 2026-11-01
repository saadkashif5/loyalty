import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TapTapSell Admin",
  description: "Platform console for the TapTapSell team.",
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
