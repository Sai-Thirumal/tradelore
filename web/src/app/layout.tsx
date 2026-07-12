import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const title = "TradeLore — Your Trading Companion for Journaling & Analytics";
const description = "Plan, journal and review your trades while TradeLore turns your trading data into insights that help you improve.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.tradelore.co.in"),
  applicationName: "TradeLore",
  title: {
    default: title,
    template: "%s | TradeLore",
  },
  description,
  icons: {
    icon: [
      { url: "/tradelore-icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
