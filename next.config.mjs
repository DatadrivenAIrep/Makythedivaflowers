// Plain ESM on purpose, not next.config.ts. Hostinger's build server has an
// old glibc, so Next 16.3+ cannot load its native SWC binary there (it needs
// GLIBC_2.29+) and falls back to WebAssembly SWC. That fallback cannot
// transpile a TypeScript config ("Cannot find module …next.config imported
// from next.config.compiled.js") and cannot run Turbopack, which is why
// `npm run build` passes --webpack. Reproduce locally with
// `NEXT_TEST_WASM=1 npm run build`.
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

// Maky's loyalty card lives in a separate app (Tarjeta Fiel).
const LOYALTY_SIGNUP_URL = "https://lightsalmon-dinosaur-949507.hostingersite.com/maky-the-diva-flowers";

/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  async redirects() {
    return [
      // One host only. `www` used to serve a full copy of the site, which
      // Search Console filed as "alternate page with proper canonical".
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.makythedivaflowers.com" }],
        destination: "https://makythedivaflowers.com/:path*",
        permanent: true,
      },
      { source: "/:locale(en|es)/prom", destination: "/:locale/corsages-boutonnieres", permanent: true },
      // Sign-in is by SMS code, so there is nothing to sign up for: the
      // account exists once you have ordered.
      { source: "/:locale(en|es)/account/sign-up", destination: "/:locale/account", permanent: true },
      { source: "/:locale(en|es)/shop/sympathy", destination: "/:locale/sympathy", permanent: true },
      // Subscriptions are plans, not catalog products: the shop category would list nothing.
      { source: "/:locale(en|es)/shop/subscriptions", destination: "/:locale/subscriptions", permanent: true },
      // Sympathy has a fuller page than an occasion landing would give it.
      { source: "/:locale(en|es)/ocasiones/sympathy", destination: "/:locale/sympathy", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-bouquet", destination: "/:locale/product/wrapped-red-roses", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-vase", destination: "/:locale/product/wrapped-red-roses", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-pink", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-yellow", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-white", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
      { source: "/:locale(en|es)/product/dozen-roses-in-multi-color", destination: "/:locale/product/wrapped-roses-colored", permanent: true },
      // Renamed 2026-10-22 at the owner's request (Golden Chilides → Chilides Garden).
      { source: "/:locale(en|es)/product/golden-chilides", destination: "/:locale/product/chilides-garden", permanent: true },
      // Loyalty card sign-up (the printed QR posters point here). Temporary
      // (307) on purpose: if the loyalty app moves, update LOYALTY_SIGNUP_URL
      // and every printed poster keeps working.
      { source: "/club", destination: LOYALTY_SIGNUP_URL, permanent: false },
      { source: "/:locale(en|es)/club", destination: LOYALTY_SIGNUP_URL, permanent: false },
      // Owner panel (stamps, QR scanner), linked from the dashboard's section row.
      { source: "/club/panel", destination: `${LOYALTY_SIGNUP_URL}/panel`, permanent: false },
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
    // Production builds use webpack (see the top of this file), which runs
    // PostCSS in-process. If builds ever move back to Turbopack on Hostinger,
    // restore `turbopackPluginRuntimeStrategy: "workerThreads"`: Turbopack's
    // PostCSS helper process cannot connect back to the build there ("node
    // process exited before we could connect to it"), and note that Next 16.4
    // ignores "workerThreads" on Node >= 24.13.1.
  },
};

export default withNextIntl(nextConfig);
