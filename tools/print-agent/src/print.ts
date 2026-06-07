import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { print as pdfPrint } from "pdf-to-printer";
import puppeteer, { type Browser } from "puppeteer-core";
import { logger } from "./log";

// Singleton browser. Re-used across jobs to avoid Chrome cold-start
// (~2-3s on Windows) for every print.
let browserPromise: Promise<Browser> | null = null;

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

async function getBrowser(chromePath: string): Promise<Browser> {
  if (browserPromise) return browserPromise;
  browserPromise = puppeteer.launch({
    args: LOCAL_CHROME_ARGS,
    defaultViewport: { width: 1100, height: 850 },
    executablePath: chromePath,
    headless: true,
  });
  return browserPromise;
}

async function htmlToPdf(html: string, chromePath: string): Promise<Buffer> {
  const browser = await getBrowser(chromePath);
  const page = await browser.newPage();
  try {
    // Wait for "load" (all inline resources parsed), NOT "networkidle0".
    // The sheet HTML is fully self-contained — fonts and images are embedded
    // as data: URIs, so there is no network to go idle. With large data: URIs
    // Chrome's idle accounting never reaches 0-for-500ms, so networkidle0 hangs
    // until the timeout and the render fails → a job that never prints (or, on
    // some drivers, ejects a blank sheet). "load" fires as soon as the embedded
    // assets are parsed, which is what we actually need before page.pdf().
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
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

export async function printJob(
  jobId: string,
  html: string,
  printerName: string,
  chromePath: string,
): Promise<void> {
  const tmpPath = path.join(os.tmpdir(), `maky-print-${jobId}.pdf`);
  try {
    logger.debug({ jobId }, "rendering sheet");
    const pdf = await htmlToPdf(html, chromePath);
    await fs.writeFile(tmpPath, pdf);
    logger.debug({ jobId, tmpPath, bytes: pdf.length }, "wrote pdf");
    await pdfPrint(tmpPath, {
      printer: printerName,
      side: "simplex",
      paperSize: "letter",
      scale: "fit",
    });
    logger.info({ jobId, printer: printerName }, "printed");
  } finally {
    try { await fs.unlink(tmpPath); } catch (e) {
      logger.warn({ jobId, err: (e as Error).message }, "failed to delete temp pdf");
    }
  }
}

export async function printJobWithRetry(
  jobId: string,
  html: string,
  printerName: string,
  chromePath: string,
): Promise<void> {
  const delays = [0, 5_000, 30_000, 120_000]; // 0, 5s, 30s, 2min — total 4 attempts
  let lastErr: unknown;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
    try {
      await printJob(jobId, html, printerName, chromePath);
      if (attempt > 0) logger.info({ jobId, attempt }, "print succeeded after retry");
      return;
    } catch (e) {
      lastErr = e;
      logger.warn({ jobId, attempt, err: (e as Error).message }, "print attempt failed");
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("print failed");
}

// For graceful shutdown.
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise;
  browserPromise = null;
  try { await b.close(); } catch (e) {
    logger.warn({ err: (e as Error).message }, "browser close failed");
  }
}
