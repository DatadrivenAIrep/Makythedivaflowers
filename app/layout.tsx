import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { SITE } from "@/data/site";
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
  title: SITE.metadata.title.en,
  description: SITE.metadata.description.en,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${cabinet.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
