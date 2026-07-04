import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listOrdersByCustomer } from "@/lib/order-storage";
import {
  getCustomerById, updateCustomer, normalizeTag,
  addTag, removeTag, listTagsFor, listAllTags,
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
