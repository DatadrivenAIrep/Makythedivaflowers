import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { orderToRow, rowToOrder, type OrderRow } from "@/lib/order-row";
import { saveOrder, getOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-${Math.random().toString(36).slice(2)}.json`);
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function baseOrder(id: string): Order {
  return {
    id, source: "walk-in", locale: "es",
    lines: [], fulfillment: { method: "in-store", recipient: { name: "R", phone: "555" } },
    contact: { phone: "555" },
    totals: { subtotalCents: 5000, deliveryCents: 0, taxCents: 0, totalCents: 5000 },
    status: "pending", paymentStatus: "pending",
    createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z",
  };
}

describe("migration 010", () => {
  it("creates the order_changes table", () => {
    const row = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='order_changes'")
      .get();
    expect(row).toBeTruthy();
  });

  it("round-trips amountPaidCents through orderToRow/rowToOrder", () => {
    const o = { ...baseOrder("rt1"), amountPaidCents: 1234 };
    const back = rowToOrder(orderToRow(o) as OrderRow);
    expect(back.amountPaidCents).toBe(1234);
  });

  it("defaults amountPaidCents to 0 when unset", () => {
    const back = rowToOrder(orderToRow(baseOrder("rt2")) as OrderRow);
    expect(back.amountPaidCents).toBe(0);
  });

  it("persists amount_paid_cents via saveOrder", async () => {
    await saveOrder({ ...baseOrder("sv1"), amountPaidCents: 777 });
    const got = await getOrder("sv1");
    expect(got?.amountPaidCents).toBe(777);
  });
});
