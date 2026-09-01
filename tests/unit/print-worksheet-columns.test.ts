// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";

// Column layout: delivery info lives in column 1 (the meta column), internal
// notes live in column 2. Columns render in DOM order, so on the worksheet the
// delivery info must appear before the internal notes.

function deliveryOrder(): Order {
  return {
    id: "do_cols", orderNumber: 1042, source: "walk-in", locale: "es",
    lines: [{ kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: [], qty: 1 }],
    contact: { name: "Ana", phone: "5165551234" },
    totals: { subtotalCents: 40000, deliveryCents: 1500, discountCents: 0, taxCents: 1720, totalCents: 43220 },
    status: "pending", paymentStatus: "paid",
    internalNotes: "Nota interna de prueba",
    createdAt: "2026-07-20T15:30:00.000Z", updatedAt: "2026-07-20T15:30:00.000Z",
    fulfillment: {
      method: "delivery",
      recipient: { name: "Lola Cardona", phone: "5165550101" },
      address: { street1: "45 Maple St", city: "Great Neck", state: "NY", zip: "11021", country: "US" },
      window: { date: "2026-07-22", slot: "afternoon" },
      cardMessage: "Con cariño",
    },
  };
}

describe("worksheet column layout", () => {
  it("places delivery info in column 1, before the internal notes in column 2", async () => {
    const html = await buildSheetHtml(deliveryOrder());
    const body = html.slice(html.indexOf("<body>"));
    const deliveryPos = body.indexOf("Lola Cardona"); // first hit = worksheet
    const notesPos = body.indexOf("Nota interna de prueba");
    expect(deliveryPos).toBeGreaterThan(-1);
    expect(notesPos).toBeGreaterThan(-1);
    expect(deliveryPos).toBeLessThan(notesPos);
  });
});
