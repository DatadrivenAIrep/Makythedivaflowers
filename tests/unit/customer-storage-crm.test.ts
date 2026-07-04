import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listOrdersByCustomer } from "@/lib/order-storage";
import {
  getCustomerById, updateCustomer, normalizeTag,
  addTag, removeTag, listTagsFor, listAllTags,
  listCustomers, customerStats,
} from "@/lib/customer-storage";

// Fixed "now" for deterministic segment math. All storage functions accept
// `now` as a parameter; seeds are placed relative to this instant.
export const NOW = new Date("2026-07-04T12:00:00Z");
const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

export function seedCustomer(
  id: string, name: string, phone: string,
  opts: { firstSeen?: string; email?: string } = {},
) {
  const seen = opts.firstSeen ?? "2026-01-01T00:00:00Z";
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, email, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ).run(id, name, phone, opts.email ?? null, seen, seen);
}

export function seedOrder(id: string, customerId: string, daysAgo: number, paidCents: number) {
  const at = new Date(NOW.getTime() - daysAgo * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
       contact_phone, fulfillment_method, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, amount_paid_cents, fulfillment_status, payment_status,
       created_at, updated_at)
     VALUES (?, 'es', 'walk-in', ?, 'R', '1', '1', 'pickup', '[]', 0, 0, 0, ?, ?,
       'pending', ?, ?, ?)`,
  ).run(id, customerId, paidCents > 0 ? paidCents : 5000, paidCents,
        paidCents > 0 ? "paid" : "pending", at, at);
}

describe("listOrdersByCustomer", () => {
  it("returns only that customer's orders, newest first", () => {
    seedCustomer("c1", "Ana", "5551");
    seedCustomer("c2", "Bea", "5552");
    seedOrder("o1", "c1", 10, 6000);
    seedOrder("o2", "c1", 2, 9000);
    seedOrder("o3", "c2", 1, 4000);
    const orders = listOrdersByCustomer("c1");
    expect(orders.map((o) => o.id)).toEqual(["o2", "o1"]);
  });

  it("returns empty array for a customer with no orders", () => {
    seedCustomer("c1", "Ana", "5551");
    expect(listOrdersByCustomer("c1")).toEqual([]);
  });
});

describe("getCustomerById / updateCustomer", () => {
  it("returns null for unknown id", () => {
    expect(getCustomerById("nope")).toBeNull();
  });

  it("gets a customer with notes mapped onto the object", () => {
    seedCustomer("c1", "Ana", "5551");
    getDb().prepare("UPDATE customers SET notes = 'sin lilies' WHERE id = 'c1'").run();
    const c = getCustomerById("c1");
    expect(c?.name).toBe("Ana");
    expect(c?.notes).toBe("sin lilies");
  });

  it("updates notes and contact fields; empty email clears it", () => {
    seedCustomer("c1", "Ana", "5551", { email: "ana@x.com" });
    const updated = updateCustomer("c1", {
      notes: "prefiere tonos pastel",
      name: "Ana María",
      email: "",
      messagingChannel: "whatsapp",
      locale: "en",
    });
    expect(updated).toMatchObject({
      name: "Ana María",
      notes: "prefiere tonos pastel",
      messagingChannel: "whatsapp",
      locale: "en",
    });
    expect(updated?.email).toBeUndefined();
  });

  it("update on unknown id returns null", () => {
    expect(updateCustomer("nope", { notes: "x" })).toBeNull();
  });
});

describe("tags", () => {
  it("normalizeTag trims, collapses spaces, lowercases, caps at 24 chars", () => {
    expect(normalizeTag("  Boda   Junio ")).toBe("boda junio");
    expect(normalizeTag("A".repeat(40))).toBe("a".repeat(24));
    expect(normalizeTag("   ")).toBeNull();
  });

  it("addTag is idempotent and returns the sorted tag list", () => {
    seedCustomer("c1", "Ana", "5551");
    expect(addTag("c1", "vip")).toEqual(["vip"]);
    expect(addTag("c1", "vip")).toEqual(["vip"]);
    expect(addTag("c1", "boda")).toEqual(["boda", "vip"]);
  });

  it("removeTag removes and listAllTags de-duplicates across customers", () => {
    seedCustomer("c1", "Ana", "5551");
    seedCustomer("c2", "Bea", "5552");
    addTag("c1", "boda");
    addTag("c2", "boda");
    addTag("c2", "funeral");
    expect(listAllTags()).toEqual(["boda", "funeral"]);
    expect(removeTag("c2", "funeral")).toEqual(["boda"]);
    expect(listTagsFor("c2")).toEqual(["boda"]);
  });
});

// Shared scenario:
//  ana   → 6 recent paid orders of $60  → VIP (order count), ltv 36000
//  bob   → 2 orders, last one 100 days ago → at-risk (and recurring)
//  carla → 1 recent order → new
//  dora  → no orders, first seen this month → new
function seedScenario() {
  seedCustomer("ana", "Ana", "5550001");
  seedCustomer("bob", "Bob", "5550002", { email: "bob@x.com" });
  seedCustomer("carla", "Carla", "5550003");
  seedCustomer("dora", "Dora", "5550004", { firstSeen: "2026-07-02T00:00:00Z" });
  [1, 2, 3, 4, 5, 6].forEach((d) => seedOrder(`a${d}`, "ana", d, 6000));
  seedOrder("b1", "bob", 100, 8000);
  seedOrder("b2", "bob", 150, 8000);
  seedOrder("k1", "carla", 3, 4500);
}

describe("listCustomers", () => {
  it("default sort is last_order desc; customers with no orders sort last", () => {
    seedScenario();
    const { customers } = listCustomers({}, NOW);
    expect(customers.map((c) => c.id)).toEqual(["ana", "carla", "bob", "dora"]);
  });

  it("attaches metrics and tags to each row", () => {
    seedScenario();
    addTag("ana", "vip");
    const { customers } = listCustomers({}, NOW);
    const ana = customers.find((c) => c.id === "ana")!;
    expect(ana.metrics.segment).toBe("vip");
    expect(ana.metrics.ltvCents).toBe(36000);
    expect(ana.metrics.orderCount).toBe(6);
    expect(ana.tags).toEqual(["vip"]);
    const dora = customers.find((c) => c.id === "dora")!;
    expect(dora.metrics.segment).toBe("new");
    expect(dora.metrics.ltvCents).toBe(0);
  });

  it("q matches name, phone, and email", () => {
    seedScenario();
    expect(listCustomers({ q: "car" }, NOW).customers.map((c) => c.id)).toEqual(["carla"]);
    expect(listCustomers({ q: "5550002" }, NOW).customers.map((c) => c.id)).toEqual(["bob"]);
    expect(listCustomers({ q: "bob@x" }, NOW).customers.map((c) => c.id)).toEqual(["bob"]);
  });

  it("segment filters mirror the boolean semantics", () => {
    seedScenario();
    const ids = (f: Parameters<typeof listCustomers>[0]) =>
      listCustomers(f, NOW).customers.map((c) => c.id).sort();
    expect(ids({ segment: "new" })).toEqual(["carla", "dora"]);
    expect(ids({ segment: "recurring" })).toEqual(["ana", "bob"]);
    expect(ids({ segment: "vip" })).toEqual(["ana"]);
    expect(ids({ segment: "at_risk" })).toEqual(["bob"]);
  });

  it("tag filter matches exact tag", () => {
    seedScenario();
    addTag("bob", "boda");
    expect(listCustomers({ tag: "boda" }, NOW).customers.map((c) => c.id)).toEqual(["bob"]);
    expect(listCustomers({ tag: "nope" }, NOW).customers).toEqual([]);
  });

  it("sorts: ltv, orders, name", () => {
    seedScenario();
    expect(listCustomers({ sort: "ltv" }, NOW).customers[0].id).toBe("ana");
    expect(listCustomers({ sort: "orders" }, NOW).customers[0].id).toBe("ana");
    expect(listCustomers({ sort: "name" }, NOW).customers.map((c) => c.id)).toEqual([
      "ana", "bob", "carla", "dora",
    ]);
  });

  it("paginates with an opaque cursor", () => {
    seedScenario();
    const p1 = listCustomers({ sort: "name", limit: 3 }, NOW);
    expect(p1.customers.map((c) => c.id)).toEqual(["ana", "bob", "carla"]);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = listCustomers({ sort: "name", limit: 3, cursor: p1.nextCursor! }, NOW);
    expect(p2.customers.map((c) => c.id)).toEqual(["dora"]);
    expect(p2.nextCursor).toBeNull();
  });
});

describe("customerStats", () => {
  it("computes total, newThisMonth, repeatRatePct, atRiskCount", () => {
    seedScenario();
    const stats = customerStats(NOW);
    expect(stats.total).toBe(4);
    expect(stats.newThisMonth).toBe(1); // dora, first seen 2026-07-02
    expect(stats.repeatRatePct).toBe(50); // ana + bob out of 4
    expect(stats.atRiskCount).toBe(1); // bob
  });

  it("handles an empty database", () => {
    const stats = customerStats(NOW);
    expect(stats).toEqual({ total: 0, newThisMonth: 0, repeatRatePct: 0, atRiskCount: 0 });
  });
});
