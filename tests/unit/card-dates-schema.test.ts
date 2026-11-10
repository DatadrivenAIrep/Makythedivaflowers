import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder, getOrder } from "@/lib/order-storage";
import { addImportantDate, listDatesFor } from "@/lib/customer-dates-storage";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-card-dates-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedCustomer(id: string) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, locale, messaging_channel, first_seen_at, last_seen_at)
       VALUES (?, 'C', '5165550000', 'es', 'sms', ?, ?)`,
    )
    .run(id, now, now);
}

function makeOrder(over: Partial<Order> = {}): Order {
  const now = new Date().toISOString();
  return {
    id: "o1",
    source: "web",
    locale: "es",
    customerId: "c1",
    lines: [{ kind: "catalog", productId: "p-normal", variantId: "v", addOnIds: [], qty: 1 }],
    fulfillment: {
      method: "pickup",
      recipient: { name: "Laura", phone: "5165559999" },
      window: { date: "2026-03-18", slot: "morning" },
    },
    contact: { name: "Ana", phone: "5165550100" },
    totals: { subtotalCents: 0, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 0 },
    status: "pending",
    paymentStatus: "paid",
    createdAt: now,
    updatedAt: now,
    ...over,
  } as Order;
}

describe("migration 043", () => {
  it("adds relationship, source_order_id and card_date_scans", () => {
    const db = getDb();
    const cols = (db.prepare("PRAGMA table_info(customer_important_dates)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain("relationship");
    expect(cols).toContain("source_order_id");
    const scanCols = (db.prepare("PRAGMA table_info(card_date_scans)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(scanCols).toEqual(expect.arrayContaining(["order_id", "outcome", "date_id", "scanned_at"]));
  });

  it("card_date_scans rejects an unknown outcome", () => {
    const db = getDb();
    const ins = db.prepare("INSERT INTO card_date_scans (order_id, outcome, scanned_at) VALUES (?, ?, ?)");
    expect(() => ins.run("o1", "x", "2026-01-01")).toThrow();
    for (const [i, o] of ["saved", "review", "duplicate", "excluded", "none", "dismissed"].entries()) {
      expect(() => ins.run(`ok${i}`, o, "2026-01-01")).not.toThrow();
    }
  });
});

describe("card dates storage", () => {
  it("a card date round-trips", () => {
    seedCustomer("c1");
    addImportantDate("c1", {
      kind: "birthday",
      label: "Rosa",
      month: 3,
      day: 21,
      source: "card",
      relationship: "madre",
      sourceOrderId: "o1",
    });
    const d = listDatesFor("c1")[0];
    expect(d.source).toBe("card");
    expect(d.relationship).toBe("madre");
    expect(d.sourceOrderId).toBe("o1");
    expect(d.sourceOrderNumber).toBeUndefined();
  });

  it("sourceOrderNumber comes from the order", async () => {
    seedCustomer("c1");
    await saveOrder(makeOrder({ orderNumber: 1234 }));
    const stored = await getOrder("o1");
    expect(stored?.orderNumber).toBeDefined();
    addImportantDate("c1", { kind: "birthday", label: "Rosa", month: 3, day: 21, source: "card", sourceOrderId: "o1" });
    expect(listDatesFor("c1")[0].sourceOrderNumber).toBe(stored?.orderNumber);
  });

  it("an unknown relationship reads as undefined", () => {
    seedCustomer("c1");
    addImportantDate("c1", { kind: "birthday", label: "Rosa", month: 3, day: 21, source: "card", relationship: "madre" });
    getDb().prepare("UPDATE customer_important_dates SET relationship = 'jefe'").run();
    expect(listDatesFor("c1")[0].relationship).toBeUndefined();
  });
});
