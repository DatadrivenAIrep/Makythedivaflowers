import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  async redirects() {
    return [
      { source: "/:locale(en|es)/shop/sympathy", destination: "/:locale/sympathy", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-bouquet", destination: "/:locale/product/wrapped-red-roses", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-vase", destination: "/:locale/product/wrapped-red-roses", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-pink", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-yellow", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-white", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-multi-color", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
    ];
  },
  // Native bindings + headless Chromium: keep them external so Next.js
  // doesn't try to bundle them. On hosts where chromium can't actually
  // load, `lib/print-chromium.ts` defers the import to runtime; the
  // module graph still resolves cleanly at build time.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "sharp", "pdf-parse", "twilio"],
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "framer-motion"],
    staleTimes: { dynamic: 0 },
  },
};

export default withNextIntl(nextConfig);
