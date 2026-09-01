import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder, getOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-ord-promo-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const baseOrder: Order = {
  id: "do_promo",
  source: "web",
  locale: "es",
  lines: [{ kind: "catalog", productId: "p1", variantId: "standard", addOnIds: [], qty: 1 }],
  fulfillment: {
    method: "pickup",
    recipient: { name: "María", phone: "5165550100" },
    window: { date: "2026-07-01", slot: "midday" },
  },
  contact: { phone: "5165550100", email: "a@b.com" },
  totals: {
    subtotalCents: 20000,
    deliveryCents: 0,
    discountCents: 2000,
    taxCents: 1553,
    totalCents: 19553,
  },
  status: "pending",
  paymentStatus: "paid",
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
};

describe("promo fields on an order", () => {
  it("round-trips the code, promo id and discount through storage", async () => {
    await saveOrder({ ...baseOrder, promoId: "promo_1", promoCode: "BIENVENIDA10" });
    const back = await getOrder("do_promo");
    expect(back?.promoId).toBe("promo_1");
    expect(back?.promoCode).toBe("BIENVENIDA10");
    expect(back?.totals.discountCents).toBe(2000);
  });

  it("reads back a zero discount for an order placed without a code", async () => {
    await saveOrder({
      ...baseOrder,
      id: "do_nopromo",
      totals: { ...baseOrder.totals, discountCents: 0, taxCents: 1725, totalCents: 21725 },
    });
    const back = await getOrder("do_nopromo");
    expect(back?.totals.discountCents).toBe(0);
    expect(back?.promoCode).toBeUndefined();
  });
});
