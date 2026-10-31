import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TapTapSell Admin",
  description: "Platform console for the TapTapSell team.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
