import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TapTapSell Loyalty",
  description: "Manage your loyalty programs, stampers and rewards.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
