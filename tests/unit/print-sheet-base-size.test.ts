// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { CartLine, Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";

// buildSheetHtml returns raw HTML (no Chromium). Assertions are scoped to the
// worksheet so the inlined CSS in <head> never matches.
function worksheetOf(html: string) {
  const body = html.slice(html.indexOf("<body>"));
  return body.slice(0, body.indexOf('class="card-row"'));
}

function orderFor(line: CartLine): Order {
  return {
    id: "do_base01",
    orderNumber: 1310,
    source: "walk-in",
    locale: "es",
    lines: [line],
    contact: { name: "Ana", email: "ana@example.com", phone: "5165551234" },
    totals: { subtotalCents: 12000, deliveryCents: 1500, discountCents: 0, tipCents: 0, taxCents: 1164, totalCents: 14664 },
    status: "pending",
    paymentStatus: "paid",
    createdAt: "2026-09-29T15:30:00.000Z",
    updatedAt: "2026-09-29T15:30:00.000Z",
    fulfillment: {
      method: "delivery",
      recipient: { name: "Lola Cardona", phone: "5165550101" },
      address: { street1: "45 Maple St", city: "Great Neck", state: "NY", zip: "11021", country: "US" },
      window: { date: "2026-10-02", slot: "afternoon" },
      cardMessage: "Con cariño",
    },
  };
}

describe("base size on the work sheet", () => {
  it("prints the base next to the size, so the workshop knows which container to pull", async () => {
    // Eye Candy: an arrangement sold as Standard / Grand / Diva.
    const html = await buildSheetHtml(
      orderFor({ kind: "catalog", productId: "p-arr-b2-03", variantId: "grand", addOnIds: [], qty: 1 }),
    );
    expect(worksheetOf(html)).toContain("Grande · base 6×6");
  });

  it("prints no base for a hand-tied bouquet", async () => {
    // Talita's Bouquet has the same three sizes but no container.
    const html = await buildSheetHtml(
      orderFor({ kind: "catalog", productId: "p-bou-b3-15", variantId: "grand", addOnIds: [], qty: 1 }),
    );
    const worksheet = worksheetOf(html);
    expect(worksheet).toContain("Grande");
    expect(worksheet).not.toMatch(/base \d+×\d+/);
  });
});
