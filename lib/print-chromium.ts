// lib/print-chromium.ts
// Singleton-style Chromium launcher. Re-uses one browser instance across
// renders to avoid the ~2s cold-start cost on every order.
//
// Local dev: uses system Chrome via PUPPETEER_EXECUTABLE_PATH if set,
// otherwise falls back to @sparticuz/chromium for parity with prod.
//
// Production (Vercel serverless): uses @sparticuz/chromium's bundled binary.
import "server-only";
import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

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

  const localPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const isLocalDev = process.env.NODE_ENV !== "production" && !!localPath;

  browserPromise = puppeteer.launch({
    args: isLocalDev ? LOCAL_CHROME_ARGS : chromium.args,
    defaultViewport: { width: 1100, height: 850 },
    executablePath: isLocalDev ? localPath : await chromium.executablePath(),
    headless: true,
  });
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
