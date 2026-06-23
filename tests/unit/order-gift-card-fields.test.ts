import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder, getOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-ord-gc-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const baseOrder: Order = {
  id: "do_gc",
  source: "web",
  locale: "es",
  lines: [{ kind: "catalog", productId: "p1", variantId: "standard", addOnIds: [], qty: 1 }],
  fulfillment: {
    method: "pickup",
    recipient: { name: "María", phone: "5165550100" },
    window: { date: "2026-07-01", slot: "midday" },
  },
  contact: { phone: "5165550100", email: "a@b.com" },
  totals: { subtotalCents: 19000, deliveryCents: 0, taxCents: 1639, totalCents: 20639 },
  status: "pending",
  paymentStatus: "paid",
  paymentMethod: "gift-card",
  giftCardId: "gc_1",
  giftCardCents: 15000,
  createdAt: "2026-06-22T00:00:00Z",
  updatedAt: "2026-06-22T00:00:00Z",
};

describe("order gift card fields", () => {
  it("round-trips giftCardId and giftCardCents through saveOrder/getOrder", async () => {
    await saveOrder(baseOrder);
    const read = await getOrder("do_gc");
    expect(read?.giftCardId).toBe("gc_1");
    expect(read?.giftCardCents).toBe(15000);
    expect(read?.paymentMethod).toBe("gift-card");
  });
});
