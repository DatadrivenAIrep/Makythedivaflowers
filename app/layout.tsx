import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { SITE } from "@/data/site";
import { GTMScript } from "@/components/analytics/GTMScript";
import { ClarityScript } from "@/components/analytics/ClarityScript";
import { ConsentNotice } from "@/components/analytics/ConsentNotice";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const cabinet = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "../public/fonts/CabinetGrotesk/Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk/Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk/Bold.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk/Extrabold.woff2", weight: "800", style: "normal" },
  ],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Without metadataBase, Next resolves relative og:image URLs against
  // localhost:3000 — every share card on the live site was pointing at a
  // dev-server URL and rendering blank. Keep this set.
  metadataBase: new URL(SITE.url),
  title: SITE.metadata.title.en,
  description: SITE.metadata.description.en,
  applicationName: SITE.brand,
  icons: {
    icon: "/favicon-logo.webp",
    apple: "/apple-icon.webp",
  },
  openGraph: {
    type: "website",
    siteName: SITE.merchantName,
    locale: "en_US",
    alternateLocale: ["es_US"],
  },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${cabinet.variable} ${jetbrains.variable}`}>
      <body>
        <GTMScript />
        <ClarityScript />
        {children}
        <ConsentNotice />
      </body>
    </html>
  );
}
