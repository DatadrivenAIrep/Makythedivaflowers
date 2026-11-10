import fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder } from "@/lib/order-storage";
import { listDatesFor } from "@/lib/customer-dates-storage";
import type { Order } from "@/types/order";

// The reader blows up on every card, so the scan fails from inside its own module.
vi.mock("@/lib/card-dates", () => ({
  readCard: () => {
    throw new Error("reader exploded");
  },
}));

import { scanOrderByIdSafe } from "@/lib/card-dates-scan";

// Invented people and messages only.
const CARD = "Happy birthday Mom, love always from Zebulon";
const STORAGE = `/tmp/diva-test-card-dates-scan-failure-${process.pid}.json`;

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", STORAGE);
  runMigrations();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
       VALUES ('c1', 'Ana', '5165550100', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    )
    .run();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(STORAGE, { force: true });
});

describe("scanOrderByIdSafe", () => {
  it("scanOrderByIdSafe never throws and logs no card text", async () => {
    const order: Order = {
      id: "o_fail_1",
      source: "phone",
      locale: "en",
      customerId: "c1",
      lines: [{ kind: "catalog", productId: "p-normal", variantId: "v", addOnIds: [], qty: 1 }],
      fulfillment: {
        method: "pickup",
        recipient: { name: "Rosa Pérez", phone: "5165550902" },
        window: { date: "2026-03-21", slot: "morning" },
        cardMessage: CARD,
      },
      contact: { name: "Ana", phone: "5165550100" },
      totals: { subtotalCents: 0, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 0 },
      status: "pending",
      paymentStatus: "pending",
      createdAt: "2026-03-20T15:00:00.000Z",
      updatedAt: "2026-03-20T15:00:00.000Z",
    };
    await saveOrder(order);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => scanOrderByIdSafe(order.id)).not.toThrow();

    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0]).toHaveLength(1);
    const line = String(err.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({ event: "card_dates_scan_failed", orderId: order.id, error: "reader exploded" });
    for (const secret of ["Zebulon", "birthday", "Mom", "Rosa", "Ana"]) {
      expect(line).not.toContain(secret);
    }
    // The failed scan rolled back: the order is still waiting to be read.
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM card_date_scans").get()).toEqual({ n: 0 });
    expect(listDatesFor("c1")).toEqual([]);
  });
});
