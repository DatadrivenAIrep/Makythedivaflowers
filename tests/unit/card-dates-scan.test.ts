import fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder } from "@/lib/order-storage";
import { addImportantDate, listDatesFor, removeImportantDate } from "@/lib/customer-dates-storage";
import type { Order } from "@/types/order";
import type { Product } from "@/types/product";

vi.mock("@/lib/product-prices", () => ({
  getPricedProducts: () => [
    { id: "p-normal", category: "arrangements", occasions: ["birthday"], variants: [] } as unknown as Product,
    { id: "p-sympathy", category: "sympathy", occasions: ["sympathy"], variants: [] } as unknown as Product,
  ],
}));

import { scanOrderForDates, scanOrderByIdSafe } from "@/lib/card-dates-scan";

// Invented people and messages only.
const BUYER_PHONE = "5165550100";
const NOW = new Date("2026-03-20T15:00:00.000Z");
const STORAGE = `/tmp/diva-test-card-dates-scan-${process.pid}.json`;

function seedCustomer(id: string, name: string, phone: string) {
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    )
    .run(id, name, phone);
}

type Who = { name?: string; phone?: string; date?: string };

function delivery(card: string | undefined, who: Who = {}): Order["fulfillment"] {
  return {
    method: "delivery",
    recipient: { name: who.name ?? "Rosa Pérez", phone: who.phone ?? "(516) 555-0902" },
    address: { street1: "1 Sample St", city: "Testville", state: "NY", zip: "11550", country: "US" },
    window: { date: who.date ?? "2026-03-21", slot: "morning" },
    cardMessage: card,
  };
}

let seq = 0;
function makeOrder(over: Partial<Order> = {}): Order {
  seq += 1;
  return {
    id: `o_scan_${seq}`,
    source: "phone",
    locale: "en",
    customerId: "c1",
    lines: [{ kind: "catalog", productId: "p-normal", variantId: "v", addOnIds: [], qty: 1 }],
    fulfillment: delivery("Happy birthday Mom"),
    contact: { name: "Ana", phone: BUYER_PHONE },
    totals: { subtotalCents: 0, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 0 },
    status: "pending",
    paymentStatus: "pending",
    createdAt: "2026-03-20T15:00:00.000Z",
    updatedAt: "2026-03-20T15:00:00.000Z",
    ...over,
  };
}

async function saved(over: Partial<Order> = {}): Promise<Order> {
  const order = makeOrder(over);
  await saveOrder(order);
  return order;
}

const scans = () =>
  getDb().prepare("SELECT order_id, outcome, date_id, scanned_at FROM card_date_scans ORDER BY order_id").all() as Array<{
    order_id: string;
    outcome: string;
    date_id: string | null;
    scanned_at: string;
  }>;

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", STORAGE);
  runMigrations();
  seedCustomer("c1", "Ana", BUYER_PHONE);
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(STORAGE, { force: true });
});

describe("scanOrderForDates", () => {
  it("saves a birthday from a delivery card", async () => {
    const o = await saved();
    expect(scanOrderForDates(o, NOW)).toBe("saved");
    const dates = listDatesFor("c1", NOW);
    expect(dates).toHaveLength(1);
    expect(dates[0]).toMatchObject({
      kind: "birthday",
      label: "Rosa Pérez",
      month: 3,
      day: 21,
      recipientPhone: "5165550902",
      source: "card",
      relationship: "madre",
      sourceOrderId: o.id,
    });
    expect(dates[0].year).toBeUndefined();
    expect(scans()).toEqual([
      { order_id: o.id, outcome: "saved", date_id: dates[0].id, scanned_at: NOW.toISOString() },
    ]);
  });

  it("in-store uses the New York day of creation", async () => {
    const o = await saved({
      fulfillment: {
        method: "in-store",
        recipient: { name: "Rosa Pérez", phone: "5165550902" },
        cardMessage: "Happy birthday Mom",
      },
      createdAt: "2026-03-22T02:30:00Z",
    });
    expect(scanOrderForDates(o, NOW)).toBe("saved");
    expect(listDatesFor("c1", NOW)[0]).toMatchObject({ month: 3, day: 21 });
  });

  it("bad window date falls back to creation day", async () => {
    const o = await saved({ fulfillment: delivery("Happy birthday Mom", { date: "" }) });
    expect(() => scanOrderForDates(o, NOW)).not.toThrow();
    expect(listDatesFor("c1", NOW)[0]).toMatchObject({ month: 3, day: 20 });

    // A well-shaped but impossible date is just as bad.
    seedCustomer("c2", "Bea", "5165550111");
    const p = await saved({
      customerId: "c2",
      contact: { name: "Bea", phone: "5165550111" },
      fulfillment: delivery("Happy birthday Mom", { date: "2026-13-45" }),
    });
    expect(scanOrderForDates(p, NOW)).toBe("saved");
    expect(listDatesFor("c2", NOW)[0]).toMatchObject({ month: 3, day: 20 });
  });

  it("excludes funeral, sympathy products and memorial cards", async () => {
    const funeral = await saved({ funeral: true });
    const sympathy = await saved({
      lines: [
        { kind: "catalog", productId: "p-normal", variantId: "v", addOnIds: [], qty: 1 },
        { kind: "catalog", productId: "p-sympathy", variantId: "v", addOnIds: [], qty: 1 },
      ],
    });
    const memorial = await saved({ fulfillment: delivery("Happy birthday in heaven, Mom") });
    expect(scanOrderForDates(funeral, NOW)).toBe("excluded");
    expect(scanOrderForDates(sympathy, NOW)).toBe("excluded");
    expect(scanOrderForDates(memorial, NOW)).toBe("excluded");
    expect(listDatesFor("c1", NOW)).toEqual([]);
    expect(scans().map((s) => [s.outcome, s.date_id])).toEqual([
      ["excluded", null],
      ["excluded", null],
      ["excluded", null],
    ]);
  });

  it("a product gone from the catalog does not count as sympathy", async () => {
    const o = await saved({
      lines: [{ kind: "catalog", productId: "p-retired", variantId: "v", addOnIds: [], qty: 1 }],
    });
    expect(scanOrderForDates(o, NOW)).toBe("saved");
  });

  it("ignores what is not readable yet", async () => {
    const canceled = await saved({ status: "canceled" });
    const failed = await saved({ status: "failed" });
    const noCustomer = await saved({ customerId: undefined });
    const noCard = await saved({ fulfillment: delivery("   ") });
    const unknownCustomer = await saved({ customerId: "c-missing" });
    for (const o of [canceled, failed, noCustomer, noCard, unknownCustomer]) {
      expect(scanOrderForDates(o, NOW)).toBeNull();
    }
    expect(scans()).toEqual([]);
    expect(listDatesFor("c1", NOW)).toEqual([]);
  });

  it("none and review are recorded without a date", async () => {
    const thanks = await saved({ fulfillment: delivery("Thank you for everything") });
    const unclear = await saved({ fulfillment: delivery("Happy 25th!") });
    expect(scanOrderForDates(thanks, NOW)).toBe("none");
    expect(scanOrderForDates(unclear, NOW)).toBe("review");
    expect(scans().map((s) => [s.order_id, s.outcome, s.date_id])).toEqual([
      [thanks.id, "none", null],
      [unclear.id, "review", null],
    ]);
    expect(listDatesFor("c1", NOW)).toEqual([]);
  });

  it("buyer as recipient", async () => {
    // Same phone as the buyer, another name: the name is kept, the phone is not.
    const otherName = await saved({ fulfillment: delivery("Happy birthday Mom", { name: "Rosa", phone: "(516) 555-0100" }) });
    expect(scanOrderForDates(otherName, NOW)).toBe("saved");
    expect(listDatesFor("c1", NOW)[0]).toMatchObject({ label: "Rosa", relationship: "madre" });
    expect(listDatesFor("c1", NOW)[0].recipientPhone).toBeUndefined();

    // Same name as the buyer (case and spaces aside), with a relationship: no name, no phone.
    seedCustomer("c2", "Ana", "5165550222");
    const sameName = await saved({
      customerId: "c2",
      contact: { name: "Ana", phone: "5165550222" },
      fulfillment: delivery("Happy birthday Mom", { name: " ana ", phone: "5165550222" }),
    });
    expect(scanOrderForDates(sameName, NOW)).toBe("saved");
    const [d] = listDatesFor("c2", NOW);
    expect(d).toMatchObject({ label: undefined, relationship: "madre", recipientPhone: undefined, kind: "birthday" });

    // Same name, no relationship: nobody can tell who it is for.
    seedCustomer("c3", "Ana", "5165550333");
    const noRelative = await saved({
      customerId: "c3",
      contact: { name: "Ana", phone: "5165550333" },
      fulfillment: delivery("Happy birthday", { name: " ana ", phone: "5165550333" }),
    });
    expect(scanOrderForDates(noRelative, NOW)).toBe("review");
    expect(listDatesFor("c3", NOW)).toEqual([]);
  });

  it("names match without accents, and the customer's name stands in for a missing contact name", async () => {
    seedCustomer("c2", "José Luis", "5165550222");
    const accents = await saved({
      customerId: "c2",
      contact: { phone: "5165550222" },
      fulfillment: delivery("Happy birthday", { name: "JOSE   luis", phone: "" }),
    });
    expect(scanOrderForDates(accents, NOW)).toBe("review");

    // No recipient name at all counts as the buyer.
    const noName = await saved({ fulfillment: delivery("Feliz cumpleaños mamá", { name: "", phone: "5165550999" }) });
    expect(scanOrderForDates(noName, NOW)).toBe("saved");
    const [d] = listDatesFor("c1", NOW);
    expect(d).toMatchObject({ label: undefined, recipientPhone: undefined, relationship: "madre" });
  });

  it("years become the birth year", async () => {
    const o = await saved({ fulfillment: delivery("Happy 50th birthday") });
    expect(scanOrderForDates(o, NOW)).toBe("saved");
    expect(listDatesFor("c1", NOW)[0]).toMatchObject({ kind: "birthday", year: 1976, label: "Rosa Pérez" });
  });

  it("duplicate against a staff date and against a card date without name", async () => {
    addImportantDate("c1", { kind: "birthday", label: "Rosa Pérez", month: 5, day: 2 }, NOW);
    const forRosa = await saved({ fulfillment: delivery("Happy birthday") });
    expect(scanOrderForDates(forRosa, NOW)).toBe("duplicate");
    expect(listDatesFor("c1", NOW)).toHaveLength(1);
    expect(scans().find((s) => s.order_id === forRosa.id)).toMatchObject({ outcome: "duplicate", date_id: null });

    // An anniversary for the same person is a different occasion.
    const anniversary = await saved({ fulfillment: delivery("Happy anniversary") });
    expect(scanOrderForDates(anniversary, NOW)).toBe("saved");

    seedCustomer("c2", "Bea", "5165550222");
    const first = await saved({
      customerId: "c2",
      contact: { name: "Bea", phone: "5165550222" },
      fulfillment: delivery("Happy birthday Mom", { name: "Bea", phone: "5165550222" }),
    });
    const again = await saved({
      customerId: "c2",
      contact: { name: "Bea", phone: "5165550222" },
      fulfillment: delivery("Feliz cumpleaños mami", { name: "Bea", phone: "5165550222", date: "2026-03-25" }),
    });
    expect(scanOrderForDates(first, NOW)).toBe("saved");
    expect(scanOrderForDates(again, NOW)).toBe("duplicate");
    expect(listDatesFor("c2", NOW)).toHaveLength(1);

    // Another relative without a name is another person.
    const dad = await saved({
      customerId: "c2",
      contact: { name: "Bea", phone: "5165550222" },
      fulfillment: delivery("Happy birthday Dad", { name: "Bea", phone: "5165550222" }),
    });
    expect(scanOrderForDates(dad, NOW)).toBe("saved");
    expect(listDatesFor("c2", NOW)).toHaveLength(2);
  });

  it("a card without a name is a duplicate of a named date for the same relative", async () => {
    // "Rosa Pérez · madre" is saved first.
    const named = await saved();
    expect(scanOrderForDates(named, NOW)).toBe("saved");

    // Later the buyer sends one to herself: no name to go by, same relationship.
    const unnamed = await saved({
      fulfillment: delivery("Happy birthday Mom", { name: "Ana", phone: BUYER_PHONE, date: "2026-04-02" }),
    });
    expect(scanOrderForDates(unnamed, NOW)).toBe("duplicate");
    const dates = listDatesFor("c1", NOW);
    expect(dates).toHaveLength(1);
    expect(dates[0]).toMatchObject({ label: "Rosa Pérez", relationship: "madre", sourceOrderId: named.id });
    expect(scans().find((s) => s.order_id === unnamed.id)).toMatchObject({ outcome: "duplicate", date_id: null });
  });

  it("reads an order once, even after the date is deleted", async () => {
    const o = await saved();
    expect(scanOrderForDates(o, NOW)).toBe("saved");
    expect(scanOrderForDates(o, NOW)).toBeNull();
    const [d] = listDatesFor("c1", NOW);
    removeImportantDate("c1", d.id, NOW);
    expect(scanOrderForDates(o, NOW)).toBeNull();
    expect(listDatesFor("c1", NOW)).toEqual([]);
    expect(scans()).toHaveLength(1);
  });
});

describe("scanOrderByIdSafe", () => {
  it("two scans of the same order leave one date", async () => {
    const o = await saved();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    scanOrderByIdSafe(o.id);
    scanOrderByIdSafe(o.id);
    expect(listDatesFor("c1")).toHaveLength(1);
    expect(scans()).toHaveLength(1);
    expect(scans()[0].outcome).toBe("saved");
    // The second scan stops at "already read", not at a swallowed key conflict.
    expect(err).not.toHaveBeenCalled();
  });

  it("never throws on an unknown order", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => scanOrderByIdSafe("o_does_not_exist")).not.toThrow();
    expect(scans()).toEqual([]);
    expect(err).not.toHaveBeenCalled();
  });
});
