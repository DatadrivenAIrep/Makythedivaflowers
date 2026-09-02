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
      { source: "/:locale(en|es)/prom", destination: "/:locale/corsages-boutonnieres", permanent: true },
      // Sign-in is by SMS code, so there is nothing to sign up for: the
      // account exists once you have ordered.
      { source: "/:locale(en|es)/account/sign-up", destination: "/:locale/account", permanent: true },
      { source: "/:locale(en|es)/shop/sympathy", destination: "/:locale/sympathy", permanent: true },
      // Sympathy has a fuller page than an occasion landing would give it.
      { source: "/:locale(en|es)/ocasiones/sympathy", destination: "/:locale/sympathy", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-bouquet", destination: "/:locale/product/wrapped-red-roses", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-vase", destination: "/:locale/product/wrapped-red-roses", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-pink", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-yellow", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-white", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-multi-color", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
    ];
  },
  // Cache policy. Next tags statically-prerendered pages with
  // `Cache-Control: s-maxage=31536000` (one year for shared caches). Behind the
  // Hostinger CDN that let old HTML linger long after a deploy — the page would
  // show the previous version intermittently, because different edges held
  // different copies. We force public HTML (and its same-path RSC payload) to
  // always revalidate, so a fresh deploy is served immediately. Framework-hashed
  // assets under /_next/static and /_next/image are immutable and can't be
  // matched by next.config headers(), so they stay long-cached and fast.
  //
  // IMPORTANT: server-rendered sensitive/dynamic routes must KEEP the framework's
  // no-store default, or a shared cache could store and re-serve them. Trailing
  // rules restore no-store on those prefixes (last matching rule wins):
  //   - /admin/*  (authenticated)
  //   - /order/*  (order confirmation renders recipient PII server-side)
  //   - /shop     (force-dynamic index; /shop/[category] is static and stays fresh)
  // Keep this exclusion list in sync with any new `export const dynamic =
  // "force-dynamic"` page that renders per-user or per-request content.
  async headers() {
    const revalidateAlways = "no-cache, s-maxage=0, must-revalidate";
    const neverStore = "private, no-cache, no-store, max-age=0, must-revalidate";
    return [
      { source: "/:locale(en|es)", headers: [{ key: "Cache-Control", value: revalidateAlways }] },
      { source: "/:locale(en|es)/:path*", headers: [{ key: "Cache-Control", value: revalidateAlways }] },
      { source: "/:locale(en|es)/admin/:path*", headers: [{ key: "Cache-Control", value: neverStore }] },
      { source: "/:locale(en|es)/order/:path*", headers: [{ key: "Cache-Control", value: neverStore }] },
      // Signed-in customer pages render that person's own order history.
      { source: "/:locale(en|es)/account", headers: [{ key: "Cache-Control", value: neverStore }] },
      { source: "/:locale(en|es)/account/:path*", headers: [{ key: "Cache-Control", value: neverStore }] },
      { source: "/:locale(en|es)/shop", headers: [{ key: "Cache-Control", value: neverStore }] },
    ];
  },
  // Native bindings + headless Chromium: keep them external so Next.js
  // doesn't try to bundle them. On hosts where chromium can't actually
  // load, `lib/print-chromium.ts` defers the import to runtime; the
  // module graph still resolves cleanly at build time.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "sharp", "pdf-parse", "twilio"],
  // /api/print/queue builds the order-sheet HTML by reading embedded fonts +
  // card art from public/ at runtime (readFileSync, in lib/print-styles.ts).
  // Those reads use a dynamic path the file tracer can't detect, so the assets
  // get dropped from the serverless bundle on Vercel and buildSheetHtml throws
  // ENOENT → no job is ever hydrated. Ship them explicitly with the route.
  outputFileTracingIncludes: {
    "/api/print/queue": ["./public/fonts/**/*", "./public/print/**/*", "./public/products/**/*"],
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "framer-motion"],
    staleTimes: { dynamic: 0 },
  },
};

export default withNextIntl(nextConfig);
