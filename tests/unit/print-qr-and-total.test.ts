// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";

// Fast path: buildSheetHtml returns the raw HTML string (no Chromium). We scope
// assertions to the <body> so the CSS in <head> (which mentions these class
// names) never produces false positives.

function parts(html: string) {
  const body = html.slice(html.indexOf("<body>"));
  const i = body.indexOf('class="card-row"');
  return { body, worksheet: body.slice(0, i), card: body.slice(i) };
}

function makeOrder(fulfillment: Order["fulfillment"]): Order {
  return {
    id: "do_qr01",
    orderNumber: 1042,
    source: "walk-in",
    locale: "es",
    lines: [{ kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: [], qty: 1 }],
    contact: { name: "Ana", email: "ana@example.com", phone: "5165551234" },
    totals: { subtotalCents: 40000, deliveryCents: 1500, discountCents: 0, tipCents: 0, taxCents: 1720, totalCents: 43220 },
    status: "pending",
    paymentStatus: "paid",
    createdAt: "2026-07-20T15:30:00.000Z",
    updatedAt: "2026-07-20T15:30:00.000Z",
    fulfillment,
  };
}

function deliveryOrder(): Order {
  return makeOrder({
    method: "delivery",
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    address: { street1: "45 Maple St", city: "Great Neck", state: "NY", zip: "11021", country: "US" },
    window: { date: "2026-07-22", slot: "afternoon" },
    cardMessage: "Con cariño",
  });
}

function inStoreOrder(): Order {
  return makeOrder({
    method: "in-store",
    recipient: { name: "Ana Ruiz", phone: "5165551234" },
    cardMessage: "Feliz día",
  });
}

describe("QR code on the tri-fold card (face 1)", () => {
  it("renders the QR on the brand-cover panel of the card half", async () => {
    const { worksheet, card } = parts(await buildSheetHtml(deliveryOrder()));
    expect(card).toContain("qr-chip");
    expect(worksheet).not.toContain("qr-chip");
  });

  it("labels the QR with the website it links to", async () => {
    const { card } = parts(await buildSheetHtml(deliveryOrder()));
    expect(card).toContain("makythedivaflowers.com");
  });
});

describe("total relocation to worksheet column 3", () => {
  it("removes the total from the black delivery-window box", async () => {
    const { body } = parts(await buildSheetHtml(deliveryOrder()));
    expect(body).not.toContain("total-row");
  });

  it("shows the total in worksheet column 3", async () => {
    const { worksheet } = parts(await buildSheetHtml(deliveryOrder()));
    expect(worksheet).toContain("grand-total");
    expect(worksheet).toContain("$432.20");
  });

  it("keeps the delivery-window box for delivery orders", async () => {
    const { body } = parts(await buildSheetHtml(deliveryOrder()));
    expect(body).toContain("ws-window");
  });

  it("hides the delivery-window box for in-store orders (no window)", async () => {
    const { body } = parts(await buildSheetHtml(inStoreOrder()));
    expect(body).not.toContain("ws-window");
  });

  it("still shows the total in column 3 for in-store orders", async () => {
    const { worksheet } = parts(await buildSheetHtml(inStoreOrder()));
    expect(worksheet).toContain("grand-total");
    expect(worksheet).toContain("$432.20");
  });
});
