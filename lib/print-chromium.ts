// lib/print-chromium.ts
// Singleton-style Chromium launcher. Re-uses one browser instance across
// renders to avoid the ~2s cold-start cost on every order.
//
// puppeteer-core and @sparticuz/chromium are loaded LAZILY via dynamic
// import() so that simply importing this module does not crash the
// process on hosts that can't load them (e.g. shared Node hosts where
// the chromium binary is incompatible). When `renderHtmlToPdf` is
// invoked and the dynamic load fails, the error propagates to the
// caller, which (in the print pipeline) is caught by the webhook's
// try/catch around `enqueuePrintJob`. That keeps the rest of the
// payment flow — order status, notification email, analytics — alive
// even if rendering itself is broken on this host.
//
// Local dev: uses system Chrome via PUPPETEER_EXECUTABLE_PATH if set,
// otherwise falls back to @sparticuz/chromium for parity with prod.
import "server-only";

// Use loose Browser type to avoid pulling puppeteer-core types at
// module load. The real type is checked at runtime.
type Browser = {
  newPage(): Promise<{
    setContent: (html: string, opts: { waitUntil: string }) => Promise<void>;
    pdf: (opts: Record<string, unknown>) => Promise<Buffer | Uint8Array>;
    close(): Promise<void>;
  }>;
  close(): Promise<void>;
};

let browserPromise: Promise<Browser> | null = null;

// Minimal args for a local system Chrome (macOS / Linux desktop).
// chromium.args includes --single-process and --no-zygote which break
// system Chrome on macOS — only use those for the serverless binary.
const LOCAL_CHROME_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--disable-background-networking",
  "--no-first-run",
  "--no-default-browser-check",
  "--mute-audio",
];

async function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;

  // Lazy import — runs only when a render is actually requested.
  // If the host can't load these (shared hosting without serverless
  // Chrome support, etc.), the error bubbles up to the caller.
  const [puppeteerMod, chromiumMod] = await Promise.all([
    import("puppeteer-core"),
    import("@sparticuz/chromium"),
  ]);
  const puppeteer = puppeteerMod.default ?? puppeteerMod;
  const chromium = chromiumMod.default ?? chromiumMod;

  const localPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const isLocalDev = process.env.NODE_ENV !== "production" && !!localPath;

  browserPromise = puppeteer.launch({
    args: isLocalDev ? LOCAL_CHROME_ARGS : chromium.args,
    defaultViewport: { width: 1100, height: 850 },
    executablePath: isLocalDev ? localPath : await chromium.executablePath(),
    headless: true,
  }) as Promise<Browser>;
  return browserPromise;
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "Letter",
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

// For tests + graceful shutdown.
export async function __closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise;
  browserPromise = null;
  await b.close();
}
