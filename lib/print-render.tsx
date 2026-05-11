// lib/print-render.tsx
// Renders an Order to a 2-page Letter-landscape PDF for duplex printing.
// Page 1 (Side A) = worksheet (top) + card front + back cover (bottom)
// Page 2 (Side B) = blank (top) + card interior message (bottom)
//
// The Buffer returned has the same shape as the v1 API, so callers
// (lib/print-queue.ts and tests) require no changes.
import "server-only";
import { PDFDocument } from "pdf-lib";
import type { Order } from "@/types/order";
import { renderHtmlToPdf } from "@/lib/print-chromium";
import { buildSideAHtml, buildSideBHtml } from "@/lib/print-render-html";

export async function renderOrderPdf(order: Order): Promise<Buffer> {
  // Render the two pages serially. Chromium's page pool inside the singleton
  // browser handles concurrency; serial here keeps memory predictable.
  const sideA = await renderHtmlToPdf(await buildSideAHtml(order));
  const sideB = await renderHtmlToPdf(await buildSideBHtml(order));

  // Each render returns a single-page PDF. Merge them into one 2-page PDF.
  const merged = await PDFDocument.create();
  // Use new Uint8Array() to ensure pdf-lib accepts the buffer across environments
  // (jsdom's Uint8Array prototype differs from the worker context's Buffer class).
  const docA = await PDFDocument.load(new Uint8Array(sideA));
  const docB = await PDFDocument.load(new Uint8Array(sideB));
  const [pageA] = await merged.copyPages(docA, [0]);
  const [pageB] = await merged.copyPages(docB, [0]);
  merged.addPage(pageA);
  merged.addPage(pageB);
  const bytes = await merged.save();
  return Buffer.from(bytes);
}
