import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "framer-motion"],
    staleTimes: { dynamic: 0 },
  },
};

export default withNextIntl(nextConfig);
