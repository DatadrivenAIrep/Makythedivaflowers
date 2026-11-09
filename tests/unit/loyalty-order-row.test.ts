import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { orderToRow, rowToOrder } from "@/lib/order-row";
import { buildInvoiceModel } from "@/lib/invoice";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const base: Order = {
  id: "do_loy",
  orderNumber: 2001,
  source: "web",
  locale: "en",
  lines: [{ kind: "custom", title: "Roses", priceCents: 10000, qty: 1 }],
  fulfillment: {
    method: "pickup",
    recipient: { name: "Lola", phone: "5165550100" },
    window: { date: "2099-01-01", slot: "midday" },
  },
  contact: { phone: "5165550100" },
  totals: { subtotalCents: 10000, deliveryCents: 0, discountCents: 1000, tipCents: 0, taxCents: 800, totalCents: 9800 },
  status: "pending",
  paymentStatus: "pending",
  amountPaidCents: 0,
  smsConsent: false,
  smsMarketingConsent: false,
  createdAt: "2026-05-16T00:00:00.000Z",
  updatedAt: "2026-05-16T00:00:00.000Z",
};

describe("loyalty order fields", () => {
  it("round-trips the reward fields through orderToRow/rowToOrder", () => {
    const o: Order = {
      ...base,
      loyaltyRewardId: "rw_1",
      loyaltyRewardLabel: "10% off",
      loyaltyRewardPercent: 10,
      loyaltyJoin: true,
    };
    const row = orderToRow(o);
    expect(row.loyalty_reward_id).toBe("rw_1");
    expect(row.loyalty_reward_label).toBe("10% off");
    expect(row.loyalty_reward_percent).toBe(10);
    expect(row.loyalty_join).toBe(1);
    expect(rowToOrder(row)).toEqual(o);
  });

  it("leaves all four fields absent on an order without a reward", () => {
    const back = rowToOrder(orderToRow(base));
    expect(back).not.toHaveProperty("loyaltyRewardId");
    expect(back).not.toHaveProperty("loyaltyRewardLabel");
    expect(back).not.toHaveProperty("loyaltyRewardPercent");
    expect(back).not.toHaveProperty("loyaltyJoin");
  });

  it("invoice shows the reward label on the discount line when there is no promo code", () => {
    const m = buildInvoiceModel({ ...base, loyaltyRewardLabel: "10% off" });
    const line = m.totals.find((r) => r.kind === "negative");
    expect(line?.label).toContain("(10% off)");
    const withPromo = buildInvoiceModel({ ...base, promoCode: "SAVE", loyaltyRewardLabel: "10% off" });
    expect(withPromo.totals.find((r) => r.kind === "negative")?.label).toContain("(SAVE)");
  });

  it("migration creates loyalty_sync and rejects an unknown status", () => {
    const db = getDb();
    const ins = db.prepare(
      `INSERT INTO loyalty_sync (order_id, kind, loyalty_order_id, status, created_at, updated_at)
       VALUES (?, ?, 'diva-1', ?, 'x', 'x')`,
    );
    ins.run("o1", "sync", "pending");
    expect(() => ins.run("o2", "sync", "bogus")).toThrow();
    expect(() => ins.run("o3", "bogus", "pending")).toThrow();
    expect(() => ins.run("o1", "sync", "done")).toThrow(); // primary key (order_id, kind)
    db.prepare("INSERT INTO loyalty_sms_codes (phone, code_hash, expires_at) VALUES ('1','h','x')").run();
  });
});
