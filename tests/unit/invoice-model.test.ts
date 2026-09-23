import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { buildInvoiceModel } from "@/lib/invoice";

const NOW = new Date("2026-09-22T15:00:00Z");

function order(over: Partial<Order> = {}): Order {
  return {
    id: "ord_abcdef123456",
    orderNumber: 1001,
    source: "phone",
    locale: "en",
    lines: [
      { kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: ["candles"], qty: 2 },
      { kind: "custom", title: "Custom sympathy spray", priceCents: 15000, designerNotes: "SECRET-DESIGN", qty: 1 },
    ],
    fulfillment: {
      method: "delivery",
      recipient: { name: "Lola Cardona", phone: "5165550101" },
      address: { street1: "12 Main St", street2: "Apt 3", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2026-09-25", slot: "midday" },
      cardMessage: "SECRET-CARD",
    },
    contact: { name: "Ana Buyer", email: "ana@example.com", phone: "5165551234" },
    totals: { subtotalCents: 41800, deliveryCents: 1500, discountCents: 0, tipCents: 0, taxCents: 3734, totalCents: 47034 },
    status: "pending",
    paymentStatus: "paid",
    paymentMethod: "zelle",
    paidAt: "2026-09-21T14:00:00Z",
    amountPaidCents: 47034,
    internalNotes: "SECRET-NOTE",
    takenBy: "SECRET-STAFF",
    createdAt: "2026-09-21T13:00:00Z",
    updatedAt: "2026-09-21T13:00:00Z",
    ...over,
  };
}

describe("buildInvoiceModel", () => {
  it("numbers the invoice from the order number", () => {
    expect(buildInvoiceModel(order(), { now: NOW }).number).toBe("INV-1001");
  });

  it("falls back to the last 6 of the id for legacy orders", () => {
    expect(buildInvoiceModel(order({ orderNumber: undefined }), { now: NOW }).number).toBe("INV-123456");
  });

  it("resolves catalog lines with variant and add-ons, and custom lines", () => {
    const m = buildInvoiceModel(order(), { now: NOW });
    expect(m.lines).toEqual([
      { title: "Abundant Table — Standard", addOns: ["Add taper candle pair"], qty: 2, unitCents: 13400, amountCents: 26800 },
      { title: "Custom sympathy spray", addOns: [], qty: 1, unitCents: 15000, amountCents: 15000 },
    ]);
  });

  it("keeps an unresolvable catalog line with no price", () => {
    const m = buildInvoiceModel(order({
      lines: [{ kind: "catalog", productId: "p-gone", variantId: "x", addOnIds: [], qty: 1 }],
    }), { now: NOW });
    expect(m.lines).toEqual([{ title: "p-gone", addOns: [], qty: 1, unitCents: null, amountCents: null }]);
  });

  it("shows totals straight from order.totals, hiding zero discount and tip", () => {
    const m = buildInvoiceModel(order(), { now: NOW });
    expect(m.totals).toEqual([
      { label: "Subtotal", cents: 41800 },
      { label: "Delivery", cents: 1500 },
      { label: "Sales tax (NY)", cents: 3734 },
      { label: "Total", cents: 47034, kind: "total" },
    ]);
  });

  it("shows discount with the promo code and the tip when present", () => {
    const m = buildInvoiceModel(order({
      promoCode: "SPRING10",
      totals: { subtotalCents: 41800, deliveryCents: 1500, discountCents: 4180, tipCents: 1000, taxCents: 3374, totalCents: 43494 },
    }), { now: NOW });
    expect(m.totals).toContainEqual({ label: "Discount (SPRING10)", cents: 4180, kind: "negative" });
    expect(m.totals).toContainEqual({ label: "Tip", cents: 1000 });
  });

  it("marks a fully paid order as paid with method and date", () => {
    const m = buildInvoiceModel(order(), { now: NOW });
    expect(m.status).toBe("paid");
    expect(m.payments).toHaveLength(1);
    expect(m.payments[0].label).toMatch(/^Paid · Zelle · /);
    expect(m.payments[0].cents).toBe(47034);
  });

  it("shows balance due on a partial payment", () => {
    const m = buildInvoiceModel(order({ paymentStatus: "pending", amountPaidCents: 20000 }), { now: NOW });
    expect(m.status).toBe("balance_due");
    expect(m.payments.at(-1)).toEqual({ label: "Balance due", cents: 27034, kind: "balance" });
  });

  it("shows a credit when overpaid", () => {
    const m = buildInvoiceModel(order({ amountPaidCents: 50000 }), { now: NOW });
    expect(m.payments.at(-1)).toEqual({ label: "Credit", cents: 2966, kind: "balance" });
  });

  it("marks refunded orders", () => {
    const m = buildInvoiceModel(order({ paymentStatus: "refunded" }), { now: NOW });
    expect(m.status).toBe("refunded");
    expect(m.payments.some((p) => p.kind === "balance")).toBe(false);
  });

  it("marks canceled unrefunded orders, with no balance row", () => {
    const m = buildInvoiceModel(order({ status: "canceled", paymentStatus: "pending", amountPaidCents: undefined, paidAt: undefined }), { now: NOW });
    expect(m.status).toBe("canceled");
    expect(m.payments.some((p) => p.kind === "balance")).toBe(false);
    const es = buildInvoiceModel(order({ locale: "es", status: "canceled", paymentStatus: "pending", amountPaidCents: undefined, paidAt: undefined }), { now: NOW });
    expect(es.strings.status.canceled).toBe("Cancelada");
  });

  it("counts the gift card once: paid card order with a partial gift card", () => {
    const m = buildInvoiceModel(order({ giftCardCents: 5000, amountPaidCents: 47034, paymentMethod: "stripe" }), { now: NOW });
    expect(m.status).toBe("paid");
    expect(m.payments).toEqual([
      { label: "Gift card", cents: 5000, kind: "negative" },
      { label: expect.stringMatching(/^Paid · Card \(online\) · /), cents: 42034 },
    ]);
  });

  it("shows only the gift card row for a fully gift-card-paid intake order", () => {
    const m = buildInvoiceModel(order({
      giftCardCents: 47034, amountPaidCents: 47034, paymentMethod: "gift-card",
    }), { now: NOW });
    expect(m.status).toBe("paid");
    expect(m.payments).toEqual([{ label: "Gift card", cents: 47034, kind: "negative" }]);
  });

  it("shows only the gift card row for a fully gift-card-paid web order (amountPaidCents unset)", () => {
    const m = buildInvoiceModel(order({
      giftCardCents: 47034, amountPaidCents: undefined, paymentMethod: "gift-card",
    }), { now: NOW });
    expect(m.status).toBe("paid");
    expect(m.payments).toEqual([{ label: "Gift card", cents: 47034, kind: "negative" }]);
  });

  it("shows balance due on a pending order with a partial gift card", () => {
    const m = buildInvoiceModel(order({
      paymentStatus: "pending", giftCardCents: 5000, amountPaidCents: undefined, paidAt: undefined,
    }), { now: NOW });
    expect(m.status).toBe("balance_due");
    expect(m.payments.at(-1)).toEqual({ label: "Balance due", cents: 42034, kind: "balance" });
  });

  it("describes delivery, pickup and in-store fulfillment", () => {
    const d = buildInvoiceModel(order(), { now: NOW }).fulfillment;
    expect(d.heading).toBe("Deliver to");
    expect(d.name).toBe("Lola Cardona");
    expect(d.addressLines).toEqual(["12 Main St", "Apt 3", "Albertson, NY 11507"]);
    expect(d.when).toBeTruthy();

    const p = buildInvoiceModel(order({
      fulfillment: { method: "pickup", recipient: { name: "Lola", phone: "5165550101" }, window: { date: "2026-09-25", slot: "morning" } },
    }), { now: NOW }).fulfillment;
    expect(p.heading).toBe("Pickup");
    expect(p.addressLines).toEqual([]);

    const s = buildInvoiceModel(order({
      fulfillment: { method: "in-store", recipient: { name: "Lola", phone: "" } },
    }), { now: NOW }).fulfillment;
    expect(s.heading).toBe("In-store");
    expect(s.when).toBeUndefined();
    expect(s.phone).toBeUndefined();
  });

  it("bills the contact, falling back to the recipient name", () => {
    const billTo = buildInvoiceModel(order(), { now: NOW }).billTo;
    expect(billTo.name).toBe("Ana Buyer");
    expect(billTo.email).toBe("ana@example.com");
    expect(billTo.phone).toMatch(/516.*555.*1234/);
    expect(buildInvoiceModel(order({ contact: { phone: "5165551234" } }), { now: NOW }).billTo.name).toBe("Lola Cardona");
  });

  it("uses Spanish strings for es orders", () => {
    const m = buildInvoiceModel(order({ locale: "es" }), { now: NOW });
    expect(m.strings.title).toBe("Factura");
    expect(m.lines[0].title).toBe("Mesa Abundante — Clásico");
    expect(m.fulfillment.heading).toBe("Entregar a");
  });

  it("hides the Delivery row for pickup/in-store with zero delivery cents, keeps it for a delivery order with zero cents", () => {
    const pickup = buildInvoiceModel(order({
      fulfillment: { method: "pickup", recipient: { name: "Lola", phone: "5165550101" }, window: { date: "2026-09-25", slot: "morning" } },
      totals: { subtotalCents: 41800, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 3734, totalCents: 45534 },
    }), { now: NOW });
    expect(pickup.totals.some((r) => r.label === "Delivery")).toBe(false);

    const inStore = buildInvoiceModel(order({
      fulfillment: { method: "in-store", recipient: { name: "Lola", phone: "" } },
      totals: { subtotalCents: 41800, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 3734, totalCents: 45534 },
    }), { now: NOW });
    expect(inStore.totals.some((r) => r.label === "Delivery")).toBe(false);

    const delivery = buildInvoiceModel(order({
      totals: { subtotalCents: 41800, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 3734, totalCents: 45534 },
    }), { now: NOW });
    expect(delivery.totals.some((r) => r.label === "Delivery")).toBe(true);
  });

  it("formats dates in the shop's timezone, not UTC", () => {
    const m = buildInvoiceModel(order({ createdAt: "2026-09-22T02:30:00Z" }), { now: NOW });
    expect(m.orderedOn).toContain("21");
    expect(m.orderedOn).toBe("Sep 21, 2026");
  });

  it("never carries internal or card data", () => {
    const json = JSON.stringify(buildInvoiceModel(order(), { now: NOW }));
    for (const secret of ["SECRET-NOTE", "SECRET-STAFF", "SECRET-CARD", "SECRET-DESIGN"]) {
      expect(json).not.toContain(secret);
    }
  });
});
