import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { print as pdfPrint } from "pdf-to-printer";
import PDFDocument from "pdfkit";
import { loadConfig } from "./config";
import { logger } from "./log";

async function buildTestPdf(): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 72 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(20).text("Maky Print Agent — test page", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Generated ${new Date().toISOString()}`, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(10).text(
      "If you see this page, the printer connection works.\n" +
      "Run `npm run install-service` next to register the service.",
      { align: "center" },
    );
    doc.addPage();
    doc.fontSize(20).text("Maky Print Agent — page 2", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(
      "If you see this page on the BACK of the same sheet as page 1,\n" +
      "duplex is working correctly. If page 2 is on a separate sheet,\n" +
      "the printer's duplex setting needs to be enabled.",
      { align: "center" },
    );
    doc.end();
  });
}

async function main() {
  const cfg = loadConfig();
  const tmp = path.join(os.tmpdir(), `maky-test-print-${Date.now()}.pdf`);
  const pdf = await buildTestPdf();
  await fs.writeFile(tmp, pdf);
  logger.info({ printer: cfg.printerName, tmp }, "sending test page to printer");
  await pdfPrint(tmp, {
    printer: cfg.printerName,
    side: "duplexlong",
    paperSize: "letter",
    scale: "fit",
  });
  logger.info("test page submitted to printer");
  await fs.unlink(tmp);
}

main().catch((e) => {
  logger.error({ err: (e as Error).message }, "test-print failed");
  process.exit(1);
});
