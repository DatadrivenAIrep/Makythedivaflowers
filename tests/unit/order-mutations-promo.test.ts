import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createPromo, listPromos } from "@/lib/promo";
import { saveOrder } from "@/lib/order-storage";
import { markPaidManual } from "@/lib/order-mutations";
import type { Order } from "@/types/order";

vi.mock("@/lib/order-dispatch", () => ({ dispatchPaymentConfirmed: vi.fn(async () => {}) }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-mut-promo-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function seedPending(id: string, promoId?: string, promoCode?: string, discountCents = 2000) {
  const order: Order = {
    id,
    source: "walk-in",
    locale: "es",
    lines: [{ kind: "custom", title: "Ramo", priceCents: 20000, qty: 1 }],
    fulfillment: { method: "pickup", recipient: { name: "M", phone: "5165550100" }, window: { date: "2026-07-01", slot: "midday" } },
    contact: { name: "M", phone: "5165550100" },
    totals: { subtotalCents: 20000, deliveryCents: 0, discountCents, tipCents: 0, taxCents: 1553, totalCents: 19553 },
    status: "pending",
    paymentStatus: "pending",
    promoId,
    promoCode,
    createdAt: "2026-06-22T00:00:00Z",
    updatedAt: "2026-06-22T00:00:00Z",
  };
  await saveOrder(order);
}

describe("markPaidManual + promo", () => {
  it("burns the promo when a pending promo order is marked paid", async () => {
    const p = createPromo({ code: "MANUAL10", kind: "percent", value: 10 });
    await seedPending("o_promo", p.id, p.code, 2000);
    await markPaidManual("o_promo", { method: "cash" });
    expect(listPromos().find((x) => x.id === p.id)?.redemptionCount).toBe(1);
  });

  it("does not redeem twice when marked paid again (idempotent)", async () => {
    const p = createPromo({ code: "MANUAL10B", kind: "percent", value: 10 });
    await seedPending("o_promo2", p.id, p.code, 2000);
    await markPaidManual("o_promo2", { method: "cash" });
    await markPaidManual("o_promo2", { method: "zelle" });
    expect(listPromos().find((x) => x.id === p.id)?.redemptionCount).toBe(1);
  });

  it("marks a plain (no-promo) order paid without touching redemptions", async () => {
    await seedPending("o_plain");
    const order = await markPaidManual("o_plain", { method: "cash" });
    expect(order.paymentStatus).toBe("paid");
  });
});
