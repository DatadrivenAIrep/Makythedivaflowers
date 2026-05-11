// tests/unit/helpers/pdf-text.ts
// PDF text extraction helpers for tests. Uses pdf-parse, which handles
// the Type0 + /Identity-H font encoding that Chromium produces (the v1
// renderer used react-pdf which produced simpler Tj/TJ encoding).
//
// Both helpers are async because pdf-parse exposes an async API.

import { PDFDocument } from "pdf-lib";

// pdf-parse has CJS-style default export; type it loosely.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (data: Buffer | Uint8Array) => Promise<{ text: string }> = require("pdf-parse/lib/pdf-parse.js");

/**
 * Extracts all text from a PDF as one string. Newline-separated.
 */
export async function extractText(pdf: Buffer): Promise<string> {
  const result = await pdfParse(pdf);
  return result.text;
}

/**
 * Extracts text per page. Returns an array; index 0 = page 1, etc.
 * Splits the input PDF into single-page PDFs via pdf-lib, then runs
 * extractText() against each.
 */
export async function extractPageTexts(pdf: Buffer): Promise<string[]> {
  const doc = await PDFDocument.load(new Uint8Array(pdf));
  const out: string[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(doc, [i]);
    single.addPage(page);
    const bytes = await single.save();
    out.push(await extractText(Buffer.from(bytes)));
  }
  return out;
}
