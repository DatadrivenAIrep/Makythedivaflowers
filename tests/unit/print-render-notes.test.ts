// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";

// Fast path: buildSheetHtml returns the raw HTML string (no Chromium), so we can
// assert on the markup directly without paying the ~50s PDF render cost.

const baseOrder: Order = {
  id: "do_notes01",
  source: "walk-in",
  locale: "es",
  lines: [
    { kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: [], qty: 1 },
    { kind: "custom", title: "Ramo alto tonos borgoña", priceCents: 12000, designerNotes: "Rosas rojas en jarrón alto, sin relleno blanco", qty: 1 },
  ],
  contact: { name: "Ana", email: "ana@example.com", phone: "5165551234" },
  totals: { subtotalCents: 31100, deliveryCents: 0, taxCents: 2757, totalCents: 33857 },
  status: "pending",
  paymentStatus: "paid",
  internalNotes: "Entregar antes de las 2pm — cliente recoge en persona",
  createdAt: "2026-07-01T15:30:00.000Z",
  updatedAt: "2026-07-01T15:30:00.000Z",
  fulfillment: {
    method: "pickup",
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    window: { date: "2026-07-05", slot: "midday" },
    cardMessage: "Feliz cumpleaños",
  },
};

// Split the sheet HTML at the tri-fold card boundary. The customer-facing card
// panels live in `.card-row`; internal notes must never bleed into them.
function worksheetPart(html: string): string {
  const idx = html.indexOf('class="card-row"');
  expect(idx).toBeGreaterThan(-1);
  return html.slice(0, idx);
}

describe("buildSheetHtml — designer / internal notes", () => {
  it("shows the order-level internal notes on the worksheet", async () => {
    const html = await buildSheetHtml(baseOrder);
    expect(html).toContain("Entregar antes de las 2pm — cliente recoge en persona");
  });

  it("keeps internal notes off the customer-facing tri-fold card", async () => {
    const html = await buildSheetHtml(baseOrder);
    const cardPart = html.slice(html.indexOf('class="card-row"'));
    expect(cardPart).not.toContain("Entregar antes de las 2pm");
  });

  it("renders custom line items with their designer notes", async () => {
    const html = await buildSheetHtml(baseOrder);
    const ws = worksheetPart(html);
    expect(ws).toContain("Ramo alto tonos borgoña");
    expect(ws).toContain("Rosas rojas en jarrón alto, sin relleno blanco");
  });

  it("localizes the internal-notes label to English", async () => {
    const html = await buildSheetHtml({ ...baseOrder, locale: "en" });
    expect(html).toContain("Internal notes");
  });

  it("omits the notes block when there are no notes", async () => {
    const clean: Order = {
      ...baseOrder,
      internalNotes: undefined,
      lines: [{ kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: [], qty: 1 }],
    };
    const html = await buildSheetHtml(clean);
    expect(html).not.toContain("Notas internas");
  });
});
