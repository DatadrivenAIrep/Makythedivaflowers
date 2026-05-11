import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { print as pdfPrint } from "pdf-to-printer";
import { logger } from "./log";

export async function printPdf(jobId: string, pdfBase64: string, printerName: string): Promise<void> {
  const tmpPath = path.join(os.tmpdir(), `maky-print-${jobId}.pdf`);
  try {
    await fs.writeFile(tmpPath, Buffer.from(pdfBase64, "base64"));
    logger.debug({ jobId, tmpPath }, "wrote temp pdf");
    await pdfPrint(tmpPath, {
      printer: printerName,
      // v2 renders a 2-page PDF designed for duplex (front + back of one sheet).
      // pdf-to-printer's typed `side` option translates to the printer's
      // long-edge-binding duplex mode; `paperSize` and `scale` ensure Letter
      // landscape with no scaling.
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

export async function printPdfWithRetry(
  jobId: string,
  pdfBase64: string,
  printerName: string,
): Promise<void> {
  const delays = [0, 5_000, 30_000, 120_000]; // immediate, 5s, 30s, 2min — total 4 attempts
  let lastErr: unknown;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
    try {
      await printPdf(jobId, pdfBase64, printerName);
      if (attempt > 0) logger.info({ jobId, attempt }, "print succeeded after retry");
      return;
    } catch (e) {
      lastErr = e;
      logger.warn({ jobId, attempt, err: (e as Error).message }, "print attempt failed");
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("print failed");
}
