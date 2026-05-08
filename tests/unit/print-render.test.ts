import { describe, it, expect } from "vitest";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

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

import type { Order } from "@/types/order";
import { renderOrderPdf } from "@/lib/print-render";

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

describe("renderOrderPdf", () => {
  it("returns a non-empty PDF buffer", async () => {
    const buf = await renderOrderPdf(baseOrder);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
