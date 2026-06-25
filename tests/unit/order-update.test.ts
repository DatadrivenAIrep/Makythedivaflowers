import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder, getOrder, updateOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-${Math.random().toString(36).slice(2)}.json`);
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function baseOrder(id: string): Order {
  return {
    id, source: "walk-in", locale: "es", lines: [],
    fulfillment: { method: "in-store", recipient: { name: "R", phone: "555" } },
    contact: { phone: "555" },
    totals: { subtotalCents: 5000, deliveryCents: 0, taxCents: 0, totalCents: 5000 },
    status: "pending", paymentStatus: "pending",
    createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z",
  };
}

describe("updateOrder", () => {
  it("updates fields in place without creating a duplicate", async () => {
    await saveOrder(baseOrder("u1"));
    await updateOrder({ ...baseOrder("u1"), contact: { phone: "999" } });
    const got = await getOrder("u1");
    expect(got?.contact.phone).toBe("999");
  });
});
