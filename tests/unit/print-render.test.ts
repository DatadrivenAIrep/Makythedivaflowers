import { describe, it, expect } from "vitest";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import type { Order } from "@/types/order";
import { renderOrderPdf } from "@/lib/print-render";
import { extractText } from "./helpers/pdf-text";

describe("@react-pdf/renderer smoke test", () => {
  it("renders a one-page PDF buffer", async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "LETTER" },
        React.createElement(Text, null, "hello"),
      ),
    );
    const buf = await renderToBuffer(doc);
    expect(buf).toBeInstanceOf(Buffer);
    // PDF magic header: %PDF-
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

const baseOrder: Order = {
  id: "do_test123",
  locale: "en",
  lines: [],
  contact: { email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
  status: "paid",
  createdAt: "2026-05-07T15:30:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    window: { date: "2026-05-15", slot: "midday" },
    cardMessage: "Happy birthday",
  },
};

describe("renderOrderPdf — order ticket", () => {
  it("includes order id, total, Stripe PI, recipient, items, buyer contact", async () => {
    const order: Order = {
      ...baseOrder,
      stripePaymentIntentId: "pi_3O123abc",
      lines: [
        { productId: "p-arr-m01", variantId: "standard", addOnIds: ["balloon"], qty: 2 },
      ],
    };
    const buf = await renderOrderPdf(order);
    const text = await extractText(buf);
    expect(text).toContain("do_test123");
    expect(text).toContain("$207.47");
    expect(text).toContain("pi_3O123abc");
    expect(text).toContain("Lola Cardona");
    expect(text).toContain("buyer@example.com");
  });

  it("renders DELIVER TO block for delivery orders", async () => {
    const order: Order = {
      ...baseOrder,
      delivery: {
        method: "delivery",
        recipient: { name: "María González", phone: "2125550142" },
        address: {
          street1: "123 Park Ave",
          street2: "Apt 4B",
          city: "New York",
          state: "NY",
          zip: "10016",
          country: "US",
        },
        window: { date: "2026-05-07", slot: "afternoon" },
        cardMessage: "Te quiero",
      },
    };
    const buf = await renderOrderPdf(order);
    const text = await extractText(buf);
    expect(text).toContain("DELIVER TO");
    expect(text).toContain("123 Park Ave");
    expect(text).not.toContain("PICK UP AT SHOP");
  });

  it("renders PICK UP AT SHOP block for pickup orders", async () => {
    const buf = await renderOrderPdf(baseOrder);
    const text = await extractText(buf);
    expect(text).toContain("PICK UP AT SHOP");
    expect(text).toContain("1077 Willis Ave");
  });

  it("localizes ticket to Spanish when order.locale === 'es'", async () => {
    const order: Order = { ...baseOrder, locale: "es" };
    const buf = await renderOrderPdf(order);
    const text = await extractText(buf);
    expect(text).toContain("RECOGER EN TIENDA");
    expect(text).not.toContain("PICK UP AT SHOP");
  });
});
