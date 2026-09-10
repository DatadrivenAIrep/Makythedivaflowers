// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";

// buildSheetHtml returns raw HTML (no Chromium). Assertions are scoped to the
// worksheet or the card row so the inlined CSS in <head> never matches.
function parts(html: string) {
  const body = html.slice(html.indexOf("<body>"));
  const i = body.indexOf('class="card-row"');
  return { worksheet: body.slice(0, i), card: body.slice(i) };
}

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: "do_det01",
    orderNumber: 1205,
    source: "walk-in",
    locale: "es",
    lines: [{ kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: [], qty: 1 }],
    contact: { name: "Ana", email: "ana@example.com", phone: "5165551234" },
    totals: { subtotalCents: 40000, deliveryCents: 1500, discountCents: 0, tipCents: 0, taxCents: 1720, totalCents: 43220 },
    status: "pending",
    paymentStatus: "paid",
    createdAt: "2026-09-10T15:30:00.000Z",
    updatedAt: "2026-09-10T15:30:00.000Z",
    fulfillment: {
      method: "delivery",
      recipient: { name: "Lola Cardona", phone: "5165550101" },
      address: { street1: "45 Maple St", city: "Great Neck", state: "NY", zip: "11021", country: "US" },
      window: { date: "2026-09-12", slot: "afternoon" },
      cardMessage: "Con cariño",
    },
    ...over,
  };
}

describe("order number on the tri-fold card", () => {
  it("prints the order number on the card so it can be matched to its work sheet", async () => {
    const { card } = parts(await buildSheetHtml(makeOrder()));
    expect(card).toContain("#1205");
  });

  it("prints the order number on a pickup card", async () => {
    const order = makeOrder({
      fulfillment: {
        method: "pickup",
        recipient: { name: "Lola Cardona", phone: "5165550101" },
        window: { date: "2026-09-12", slot: "afternoon" },
      },
    });
    expect(parts(await buildSheetHtml(order)).card).toContain("#1205");
  });

  it("prints the order number on an in-store card", async () => {
    const order = makeOrder({
      fulfillment: { method: "in-store", recipient: { name: "Lola Cardona", phone: "5165550101" } },
    });
    expect(parts(await buildSheetHtml(order)).card).toContain("#1205");
  });

  it("falls back to the order id when the order has no number", async () => {
    const order = makeOrder({ orderNumber: undefined });
    expect(parts(await buildSheetHtml(order)).card).toContain("#do_det01");
  });
});

describe("delivery time vs delivery window label", () => {
  function withWindow(time: string | undefined, locale: Order["locale"] = "es"): Order {
    return makeOrder({
      locale,
      fulfillment: {
        method: "delivery",
        recipient: { name: "Lola Cardona", phone: "5165550101" },
        address: { street1: "45 Maple St", city: "Great Neck", state: "NY", zip: "11021", country: "US" },
        window: { date: "2026-09-12", slot: "afternoon", ...(time ? { time } : {}) },
      },
    });
  }

  it("labels the box as an exact time when the intake captured one", async () => {
    const { worksheet } = parts(await buildSheetHtml(withWindow("14:30")));
    expect(worksheet).toContain("Hora de entrega");
    expect(worksheet).not.toContain("Ventana de entrega");
    expect(worksheet).toContain("2:30 p.m."); // es-US clock format
  });

  it("labels the box as a window when the order is a flexible slot", async () => {
    const { worksheet } = parts(await buildSheetHtml(withWindow(undefined)));
    expect(worksheet).toContain("Ventana de entrega");
    expect(worksheet).not.toContain("Hora de entrega");
  });

  it("uses the English exact-time label on an English order", async () => {
    const { worksheet } = parts(await buildSheetHtml(withWindow("14:30", "en")));
    expect(worksheet).toContain("Delivery time");
    expect(worksheet).not.toContain("Delivery window");
    expect(worksheet).toContain("2:30 PM");
  });
});

describe("itemised totals on the work sheet", () => {
  function loaded(over: Partial<Order> = {}): Order {
    return makeOrder({
      totals: {
        subtotalCents: 40000,
        deliveryCents: 1500,
        discountCents: 5000,
        tipCents: 3000,
        taxCents: 1720,
        totalCents: 41220,
      },
      promoCode: "SANVAL20",
      giftCardCents: 2000,
      paymentMethod: "zelle",
      ...over,
    });
  }

  it("gives every amount its own labelled line", async () => {
    const { worksheet } = parts(await buildSheetHtml(loaded()));
    for (const label of ["Subtotal", "Descuento", "SANVAL20", "Envío", "Tax", "Propina", "Gift card", "Total"]) {
      expect(worksheet).toContain(label);
    }
    // Whole-dollar amounts format without cents ("$400", not "$400.00").
    for (const amount of ["$400", "$50", "$15", "$17.20", "$30", "$20", "$412.20"]) {
      expect(worksheet).toContain(amount);
    }
  });

  it("drops the old three-in-one subtotal row", async () => {
    const { worksheet } = parts(await buildSheetHtml(loaded()));
    expect(worksheet).not.toContain("Subt · Env · Tax");
  });

  it("leaves out discount, tip and gift card when the order has none", async () => {
    const { worksheet } = parts(await buildSheetHtml(makeOrder()));
    expect(worksheet).toContain("Subtotal");
    expect(worksheet).not.toContain("Descuento");
    expect(worksheet).not.toContain("Propina");
    expect(worksheet).not.toContain("Gift card");
  });

  it("shows what was paid and what is still owed when partially paid", async () => {
    const { worksheet } = parts(await buildSheetHtml(loaded({ amountPaidCents: 10000, paymentStatus: "pending" })));
    expect(worksheet).toContain("Pagado");
    expect(worksheet).toContain("$100");
    expect(worksheet).toContain("Saldo pendiente");
    expect(worksheet).toContain("$312.20");
  });

  it("stays quiet about the balance when the order is settled", async () => {
    const { worksheet } = parts(await buildSheetHtml(loaded({ amountPaidCents: 41220 })));
    expect(worksheet).not.toContain("Saldo pendiente");
    expect(worksheet).not.toContain("Pagado");
  });

  it("names the payment method", async () => {
    const { worksheet } = parts(await buildSheetHtml(loaded()));
    expect(worksheet).toContain("Zelle");
  });

  it("uses English labels on an English order", async () => {
    const { worksheet } = parts(await buildSheetHtml(loaded({ locale: "en", amountPaidCents: 10000 })));
    for (const label of ["Subtotal", "Discount", "Delivery", "Tax", "Tip", "Gift card", "Balance due"]) {
      expect(worksheet).toContain(label);
    }
  });
});

describe("fitting a long order on a fixed-size sheet", () => {
  const catalogLine = (): Order["lines"][number] =>
    ({ kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: [], qty: 1 });

  it("shows product photos on a short order", async () => {
    const { worksheet } = parts(await buildSheetHtml(makeOrder({ lines: [catalogLine(), catalogLine()] })));
    expect(worksheet).toContain("item-thumb");
  });

  it("drops the product photos once the order runs long, to keep the money block and buyer on the page", async () => {
    const order = makeOrder({ lines: [catalogLine(), catalogLine(), catalogLine(), catalogLine()] });
    const { worksheet } = parts(await buildSheetHtml(order));
    expect(worksheet).not.toContain("item-thumb");
  });
});

describe("the paid-on date", () => {
  it("prints a readable date instead of the raw ISO timestamp", async () => {
    const { worksheet } = parts(await buildSheetHtml(makeOrder()));
    expect(worksheet).not.toContain("2026-09-10T15:30:00.000Z");
    expect(worksheet).toContain("10 sept 2026");
  });
});
