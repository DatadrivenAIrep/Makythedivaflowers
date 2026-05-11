import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { print as pdfPrint } from "pdf-to-printer";
import puppeteer, { type Browser } from "puppeteer-core";
import { PDFDocument } from "pdf-lib";
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
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
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

async function mergePages(pageA: Buffer, pageB: Buffer): Promise<Buffer> {
  const merged = await PDFDocument.create();
  const docA = await PDFDocument.load(new Uint8Array(pageA));
  const docB = await PDFDocument.load(new Uint8Array(pageB));
  const [pA] = await merged.copyPages(docA, [0]);
  const [pB] = await merged.copyPages(docB, [0]);
  merged.addPage(pA);
  merged.addPage(pB);
  const bytes = await merged.save();
  return Buffer.from(bytes);
}

export async function printJob(
  jobId: string,
  htmlSideA: string,
  htmlSideB: string,
  printerName: string,
  chromePath: string,
): Promise<void> {
  const tmpPath = path.join(os.tmpdir(), `maky-print-${jobId}.pdf`);
  try {
    logger.debug({ jobId }, "rendering side A");
    const pdfA = await htmlToPdf(htmlSideA, chromePath);
    logger.debug({ jobId }, "rendering side B");
    const pdfB = await htmlToPdf(htmlSideB, chromePath);
    const merged = await mergePages(pdfA, pdfB);
    await fs.writeFile(tmpPath, merged);
    logger.debug({ jobId, tmpPath, bytes: merged.length }, "wrote merged pdf");
    await pdfPrint(tmpPath, {
      printer: printerName,
      side: "duplexlong",
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
  htmlSideA: string,
  htmlSideB: string,
  printerName: string,
  chromePath: string,
): Promise<void> {
  const delays = [0, 5_000, 30_000, 120_000]; // 0, 5s, 30s, 2min — total 4 attempts
  let lastErr: unknown;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
    try {
      await printJob(jobId, htmlSideA, htmlSideB, printerName, chromePath);
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
