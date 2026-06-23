// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getOrder, saveOrder } from "@/lib/order-storage";
import { closeDb } from "@/lib/db";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/test-orders-${Math.random().toString(36).slice(2)}.json`);
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function mkOrder(id: string): Order {
  return {
    id,
    source: "web",
    locale: "en",
    lines: [{ kind: "catalog", productId: "p", variantId: "v", addOnIds: [], qty: 1 }],
    contact: { name: "Buyer Name", phone: "5165551234" },
    totals: { subtotalCents: 1000, deliveryCents: 0, taxCents: 0, totalCents: 1000 },
    status: "pending",
    paymentStatus: "pending",
    createdAt: "2026-06-16T00:00:00Z",
    updatedAt: "2026-06-16T00:00:00Z",
    fulfillment: {
      method: "pickup",
      recipient: { name: "Test", phone: "5165551234" },
      window: { date: "2026-06-17", slot: "midday" },
    },
  };
}

describe("sequential order number", () => {
  it("assigns 1001, 1002… and round-trips through the DB", async () => {
    const a = mkOrder("do_a");
    await saveOrder(a);
    const b = mkOrder("do_b");
    await saveOrder(b);
    expect(a.orderNumber).toBe(1001);
    expect(b.orderNumber).toBe(1002);
    const got = await getOrder("do_a");
    expect(got?.orderNumber).toBe(1001);
    expect(got?.contact.name).toBe("Buyer Name");
  });
});
