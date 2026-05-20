import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adrail Demo",
  description: "Interactive sponsored interstitial demo with privacy-safe settlement proof."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
