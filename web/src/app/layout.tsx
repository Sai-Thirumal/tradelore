import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeLore — Performance Dashboard",
  description: "Performance Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body>{children}</body>
    </html>
  );
}
