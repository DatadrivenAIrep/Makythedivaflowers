// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";

const order: Order = {
  id: "do_te01", source: "phone", locale: "es",
  lines: [{ kind: "custom", title: "Altar", priceCents: 5000, qty: 1 }],
  contact: { name: "Iglesia", phone: "5165550100" },
  totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 5000 },
  status: "pending", paymentStatus: "paid",
  taxExempt: { cert: "ST-119-42" },
  createdAt: "2026-10-12T15:30:00.000Z", updatedAt: "2026-10-12T15:30:00.000Z",
  fulfillment: { method: "pickup", recipient: { name: "Iglesia", phone: "5165550100" }, window: { date: "2026-10-20", slot: "midday" } },
};

describe("printed sheet for an exempt order", () => {
  it("shows the exemption and certificate on the tax row", async () => {
    const html = await buildSheetHtml(order);
    expect(html).toContain("Exento de tax · #ST-119-42");
  });
  it("plain Tax label otherwise", async () => {
    const html = await buildSheetHtml({ ...order, taxExempt: undefined });
    expect(html).not.toContain("Exento de tax");
  });
});
