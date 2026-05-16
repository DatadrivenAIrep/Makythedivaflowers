// lib/print-render.tsx
// Renders an Order to a single-page Letter-landscape PDF.
// Top half = worksheet (invoice that stays at the shop).
// Bottom half = tri-fold card (3 panels: brand cover · message · logo).
// The shop cuts the sheet along the horizontal mid-line; the bottom half
// is then tri-folded so the Maky brand becomes the visible cover.
import "server-only";
import type { Order } from "@/types/order";
import { renderHtmlToPdf } from "@/lib/print-chromium";
import { buildSheetHtml } from "@/lib/print-render-html";

export async function renderOrderPdf(order: Order): Promise<Buffer> {
  const pdf = await renderHtmlToPdf(await buildSheetHtml(order));
  return pdf;
}
