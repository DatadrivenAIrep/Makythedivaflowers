import fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { inTransaction, withTransaction } from "@/lib/db-tx";
import { saveOrder } from "@/lib/order-storage";
import { addImportantDate, listDatesFor } from "@/lib/customer-dates-storage";
import type { Order } from "@/types/order";
import type { Product } from "@/types/product";

vi.mock("@/lib/product-prices", () => ({
  getPricedProducts: () => [
    { id: "p-normal", category: "arrangements", occasions: ["birthday"], variants: [] } as unknown as Product,
  ],
}));

import { errorClass } from "@/lib/card-dates-log";
import {
  listCardReviews,
  previewCardScan,
  resolveCardReview,
  scanPendingCardDates,
} from "@/lib/card-dates-scan";

// Invented people and messages only.
const BUYER_PHONE = "5165550100";
const NOW = new Date("2026-03-20T15:00:00.000Z");
const LATER = new Date("2026-03-25T15:00:00.000Z");
const STORAGE = `/tmp/diva-test-card-dates-history-${process.pid}.json`;

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
  // Each order a minute after the last, so "oldest first" is well defined.
  const createdAt = new Date(Date.UTC(2026, 2, 20, 12, seq)).toISOString();
  return {
    id: `o_hist_${String(seq).padStart(3, "0")}`,
    source: "phone",
    locale: "en",
    customerId: "c1",
    lines: [{ kind: "catalog", productId: "p-normal", variantId: "v", addOnIds: [], qty: 1 }],
    fulfillment: delivery("Happy birthday Mom"),
    contact: { name: "Ana", phone: BUYER_PHONE },
    totals: { subtotalCents: 0, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 0 },
    status: "pending",
    paymentStatus: "pending",
    createdAt,
    updatedAt: createdAt,
    ...over,
  };
}

async function saved(over: Partial<Order> = {}): Promise<Order> {
  const order = makeOrder(over);
  await saveOrder(order);
  return order;
}

/** A birthday, a number with no occasion, and a card with no date. */
async function threeOrders() {
  const birthday = await saved();
  const unclear = await saved({ fulfillment: delivery("Happy 25th!") });
  const thanks = await saved({ fulfillment: delivery("Thank you for everything") });
  return { birthday, unclear, thanks };
}

const scans = () =>
  getDb().prepare("SELECT order_id, outcome, date_id, scanned_at FROM card_date_scans ORDER BY order_id").all() as Array<{
    order_id: string;
    outcome: string;
    date_id: string | null;
    scanned_at: string;
  }>;

const scanOf = (orderId: string) => scans().find((s) => s.order_id === orderId);

const EMPTY = { scanned: 0, saved: 0, review: 0, duplicate: 0, excluded: 0, none: 0, failed: 0 };

/**
 * A birthday, an order whose stored lines are damaged (they hold its card text,
 * which JSON.parse quotes in its error), and an anniversary, in that order.
 */
async function withDamagedOrder() {
  const first = await saved();
  const card = "Feliz cumpleaños, Luz Gómez";
  const broken = await saved({ fulfillment: delivery(card, { name: "Luz Gómez", phone: "5165550903" }) });
  getDb().prepare("UPDATE orders SET lines_json = ? WHERE id = ?").run(card, broken.id);
  const last = await saved({ fulfillment: delivery("Happy anniversary", { name: "Marta Ruiz", phone: "5165550904" }) });
  return { first, broken, last };
}

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

describe("scanPendingCardDates", () => {
  it("runs the history once", async () => {
    await threeOrders();
    expect(scanPendingCardDates(NOW)).toEqual({ scanned: 3, saved: 1, review: 1, duplicate: 0, excluded: 0, none: 1, failed: 0 });
    expect(scanPendingCardDates(NOW)).toEqual(EMPTY);
    expect(scans()).toHaveLength(3);
    expect(listDatesFor("c1", NOW)).toHaveLength(1);
  });

  it("same person in two orders", async () => {
    const first = await saved();
    await saved({ fulfillment: delivery("Feliz cumpleaños", { date: "2026-03-28" }) });
    expect(scanPendingCardDates(NOW)).toMatchObject({ scanned: 2, saved: 1, duplicate: 1 });
    const dates = listDatesFor("c1", NOW);
    expect(dates).toHaveLength(1);
    // Oldest first: the date comes from the first order.
    expect(dates[0]).toMatchObject({ sourceOrderId: first.id, month: 3, day: 21 });
  });

  it("skips what cannot be read, and counts only what it read", async () => {
    await saved({ status: "canceled" });
    await saved({ status: "failed" });
    await saved({ fulfillment: delivery(" \n ") });
    // Blank to the reader but not to SQL's TRIM: selected, not read, not counted.
    await saved({ fulfillment: delivery(" ") });
    await saved({ fulfillment: delivery(undefined) });
    await saved({ customerId: undefined });
    // The customer row is gone: nothing to save on, never counted as pending.
    await saved({ customerId: "c-missing" });
    expect(scanPendingCardDates(NOW)).toEqual(EMPTY);
    expect(scans()).toEqual([]);
    expect(previewCardScan(NOW)).toMatchObject({ pendingOrders: 0, wouldSave: 0, wouldReview: 0 });
  });

  it("one damaged order does not stop the history", async () => {
    const { first, broken, last } = await withDamagedOrder();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(scanPendingCardDates(NOW)).toEqual({ ...EMPTY, scanned: 2, saved: 2, failed: 1 });
    expect(scans().map((s) => [s.order_id, s.outcome])).toEqual([
      [first.id, "saved"],
      [last.id, "saved"],
    ]);
    // No row for the damaged order: the next run tries it again.
    expect(scanOf(broken.id)).toBeUndefined();
    expect(listDatesFor("c1", NOW)).toHaveLength(2);

    // The log names the order and never carries the card or the person.
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0]).toHaveLength(1);
    const line = String(err.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({ event: "card_dates_scan_failed", orderId: broken.id, error: "SyntaxError" });
    for (const fragment of ["Feliz", "cumple", "Luz", "Gómez"]) expect(line).not.toContain(fragment);

    expect(scanPendingCardDates(NOW)).toEqual({ ...EMPTY, failed: 1 });
    expect(scanOf(broken.id)).toBeUndefined();
  });

  it("logs only the error class, even when the message has odd quotes and a name", async () => {
    await saved();
    const broken = await saved({ fulfillment: delivery("x", { name: "Rosa Perez" }) });
    getDb().prepare("UPDATE orders SET lines_json = ? WHERE id = ?").run('x"name":"Rosa Perez"', broken.id);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    scanPendingCardDates(NOW);
    const line = String(err.mock.calls[0][0]);
    expect(JSON.parse(line).error).toBe("SyntaxError");
    expect(line).not.toContain("Rosa");
    expect(errorClass(new SyntaxError('Unexpected "Rosa Perez"'))).toBe("SyntaxError");
    expect(errorClass("Rosa Perez")).toBe("string");
  });
});

describe("previewCardScan", () => {
  it("preview matches the run and writes nothing", async () => {
    await threeOrders();
    expect(previewCardScan(NOW)).toEqual({ pendingOrders: 3, wouldSave: 1, wouldReview: 1, unlinkedOrders: 0 });
    expect(scans()).toEqual([]);
    expect(listDatesFor("c1", NOW)).toEqual([]);
    // Same answer the second time: nothing was kept.
    expect(previewCardScan(NOW)).toEqual({ pendingOrders: 3, wouldSave: 1, wouldReview: 1, unlinkedOrders: 0 });
    expect(scanPendingCardDates(NOW)).toMatchObject({ saved: 1, review: 1 });
    expect(previewCardScan(NOW)).toEqual({ pendingOrders: 0, wouldSave: 0, wouldReview: 0, unlinkedOrders: 0 });
  });

  it("counts orders waiting for a customer", async () => {
    await saved({ customerId: undefined, paymentStatus: "paid" });
    // Not waiting: canceled or failed orders are never read, and neither is an order without a card.
    await saved({ customerId: undefined, paymentStatus: "paid", status: "canceled" });
    await saved({ customerId: undefined, paymentStatus: "paid", status: "failed" });
    await saved({ customerId: undefined, paymentStatus: "paid", fulfillment: delivery("  ") });
    expect(previewCardScan(NOW)).toEqual({ pendingOrders: 0, wouldSave: 0, wouldReview: 0, unlinkedOrders: 1 });
  });

  it("does not count unpaid orders, which linking never picks up", async () => {
    await saved({ customerId: undefined, paymentStatus: "pending" });
    expect(previewCardScan(NOW)).toEqual({ pendingOrders: 0, wouldSave: 0, wouldReview: 0, unlinkedOrders: 0 });
  });

  it("reads past a damaged order and writes nothing", async () => {
    await withDamagedOrder();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(previewCardScan(NOW)).toEqual({ pendingOrders: 2, wouldSave: 2, wouldReview: 0, unlinkedOrders: 0 });
    expect(err).toHaveBeenCalledTimes(1);
    expect(scans()).toEqual([]);
    expect(listDatesFor("c1", NOW)).toEqual([]);
  });

  it("still rethrows an error outside the per-order reading", async () => {
    await saved();
    getDb().exec("DROP TABLE card_date_scans");
    expect(() => previewCardScan(NOW)).toThrow(/card_date_scans/);
    // The transaction was closed: a new one can start.
    expect(inTransaction()).toBe(false);
    expect(withTransaction(() => "ok")).toBe("ok");
    expect(listDatesFor("c1", NOW)).toEqual([]);
  });

  it("refuses to run inside a transaction", async () => {
    await saved();
    expect(inTransaction()).toBe(false);
    let inside: boolean | undefined;
    expect(() =>
      withTransaction(() => {
        inside = inTransaction();
        return previewCardScan(NOW);
      }),
    ).toThrow("previewCardScan must not run inside a transaction");
    expect(inside).toBe(true);
    expect(inTransaction()).toBe(false);
    expect(scans()).toEqual([]);
    expect(listDatesFor("c1", NOW)).toEqual([]);
  });
});

describe("card reviews", () => {
  it("skips a corrupt review row and lists the others, logging only the order id", async () => {
    const a = await saved({ fulfillment: delivery("Happy 25th!") });
    const card = "Feliz cumpleaños, Luz Gómez";
    const broken = await saved({ fulfillment: delivery(card, { name: "Luz Gómez", phone: "5165550903" }) });
    const c = await saved({ fulfillment: delivery("Happy 30th!", { name: "Marta Ruiz", phone: "5165550904" }) });
    getDb()
      .prepare("INSERT INTO card_date_scans (order_id, outcome, date_id, scanned_at) VALUES (?, 'review', NULL, ?)")
      .run(broken.id, NOW.toISOString());
    scanPendingCardDates(NOW);
    getDb().prepare("UPDATE orders SET lines_json = ? WHERE id = ?").run(card, broken.id);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(listCardReviews().map((r) => r.orderId)).toEqual([a.id, c.id]);
    expect(err).toHaveBeenCalledTimes(1);
    const line = String(err.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({ event: "card_dates_review_row_failed", orderId: broken.id });
    for (const fragment of ["Feliz", "Luz", "Gómez"]) expect(line).not.toContain(fragment);
  });

  it("review list and resolution", async () => {
    const { unclear } = await threeOrders();
    const both = await saved({ fulfillment: delivery("Happy birthday and happy anniversary, Mom!") });
    scanPendingCardDates(NOW);

    const reviews = listCardReviews();
    expect(reviews.map((r) => r.orderId)).toEqual([unclear.id, both.id]);
    expect(reviews[0]).toEqual({
      orderId: unclear.id,
      orderNumber: unclear.orderNumber,
      customerId: "c1",
      customerName: "Ana",
      recipientName: "Rosa Pérez",
      cardMessage: "Happy 25th!",
      month: 3,
      day: 21,
      years: 25,
      needsName: false,
    });
    expect(reviews[0].orderNumber).toEqual(expect.any(Number));
    expect(reviews[1]).toMatchObject({ relationship: "madre", needsName: false });
    expect(reviews[1].years).toBeUndefined();

    expect(resolveCardReview(unclear.id, { kind: "anniversary" }, LATER)).toBe("saved");
    const dates = listDatesFor("c1", LATER).filter((d) => d.sourceOrderId === unclear.id);
    expect(dates).toHaveLength(1);
    expect(dates[0]).toMatchObject({
      kind: "anniversary",
      label: "Rosa Pérez",
      month: 3,
      day: 21,
      year: 2001,
      recipientPhone: "5165550902",
      source: "card",
    });
    // The same row is updated: one row, the date linked, the reading time kept.
    expect(scans().filter((s) => s.order_id === unclear.id)).toEqual([
      { order_id: unclear.id, outcome: "saved", date_id: dates[0].id, scanned_at: NOW.toISOString() },
    ]);
    expect(listCardReviews().map((r) => r.orderId)).toEqual([both.id]);

    expect(resolveCardReview(both.id, "dismiss", LATER)).toBe("dismissed");
    expect(scanOf(both.id)).toMatchObject({ outcome: "dismissed", date_id: null });
    expect(listCardReviews()).toEqual([]);

    // Resolved, never in review, or unknown: nothing to resolve.
    expect(resolveCardReview(unclear.id, { kind: "birthday" }, LATER)).toBe("not_found");
    expect(resolveCardReview(both.id, "dismiss", LATER)).toBe("not_found");
    const birthdayRow = scans().find((s) => s.outcome === "saved" && s.order_id !== unclear.id);
    expect(resolveCardReview(birthdayRow!.order_id, "dismiss", LATER)).toBe("not_found");
    expect(resolveCardReview("o_does_not_exist", { kind: "birthday" }, LATER)).toBe("not_found");
    expect(listDatesFor("c1", LATER)).toHaveLength(2);
  });

  it("buyer as recipient needs a name", async () => {
    const self = await saved({ fulfillment: delivery("Happy 25th!", { name: " ana ", phone: BUYER_PHONE }) });
    scanPendingCardDates(NOW);
    expect(listCardReviews()).toEqual([expect.objectContaining({ orderId: self.id, needsName: true })]);

    expect(resolveCardReview(self.id, { kind: "birthday" }, LATER)).toBe("name_required");
    expect(resolveCardReview(self.id, { kind: "birthday", name: "   " }, LATER)).toBe("name_required");
    expect(resolveCardReview(self.id, { kind: "birthday", name: "<a href>" }, LATER)).toBe("name_required");
    expect(resolveCardReview(self.id, { kind: "birthday", name: "A".repeat(41) }, LATER)).toBe("name_required");
    expect(listDatesFor("c1", LATER)).toEqual([]);
    expect(scanOf(self.id)).toMatchObject({ outcome: "review", date_id: null });

    expect(resolveCardReview(self.id, { kind: "birthday", name: " Rosa " }, LATER)).toBe("saved");
    const [d] = listDatesFor("c1", LATER);
    expect(d).toMatchObject({ kind: "birthday", label: "Rosa", year: 2001, source: "card", sourceOrderId: self.id });
    // The buyer's own phone is never kept as the person's phone.
    expect(d.recipientPhone).toBeUndefined();
    expect(scanOf(self.id)).toMatchObject({ outcome: "saved", date_id: d.id });
  });

  it("a staff-typed name is stored normalised, like the Mis fechas form", async () => {
    const curly = await saved({ fulfillment: delivery("Happy 25th!", { name: " ana ", phone: BUYER_PHONE }) });
    const decomposed = await saved({ fulfillment: delivery("Happy 30th!", { name: "Ana", phone: BUYER_PHONE }) });
    scanPendingCardDates(NOW);

    expect(resolveCardReview(curly.id, { kind: "birthday", name: " O’Brien " }, LATER)).toBe("saved");
    // "José" typed as e + combining accent.
    expect(resolveCardReview(decomposed.id, { kind: "anniversary", name: "José" }, LATER)).toBe("saved");
    const labels = listDatesFor("c1", LATER).map((d) => d.label);
    expect(labels).toContain("O'Brien");
    expect(labels).toContain("José");
    expect(labels).not.toContain("O’Brien");
  });

  it("a relationship stands in for the name", async () => {
    const self = await saved({ fulfillment: delivery("Happy 30th to my wife", { name: "Ana", phone: BUYER_PHONE }) });
    scanPendingCardDates(NOW);
    expect(listCardReviews()[0]).toMatchObject({ orderId: self.id, relationship: "esposa", years: 30, needsName: false });
    expect(resolveCardReview(self.id, { kind: "anniversary" }, LATER)).toBe("saved");
    expect(listDatesFor("c1", LATER)[0]).toMatchObject({ kind: "anniversary", relationship: "esposa", year: 1996 });
    expect(listDatesFor("c1", LATER)[0].label).toBeUndefined();
  });

  it("an anniversary past 80 years keeps no year", async () => {
    const old = await saved({ fulfillment: delivery("Happy 95th!") });
    const aged = await saved({ fulfillment: delivery("Felices 95", { name: "Luz Gómez", phone: "5165550903" }) });
    scanPendingCardDates(NOW);
    expect(listCardReviews().map((r) => r.years)).toEqual([95, 95]);

    expect(resolveCardReview(old.id, { kind: "anniversary" }, LATER)).toBe("saved");
    expect(resolveCardReview(aged.id, { kind: "birthday" }, LATER)).toBe("saved");
    const dates = listDatesFor("c1", LATER);
    expect(dates.find((d) => d.sourceOrderId === old.id)?.year).toBeUndefined();
    expect(dates.find((d) => d.sourceOrderId === aged.id)?.year).toBe(1931);
  });

  it("a resolution can be a duplicate", async () => {
    addImportantDate("c1", { kind: "birthday", label: "Rosa Pérez", month: 5, day: 2 }, NOW);
    const unclear = await saved({ fulfillment: delivery("Happy 25th!") });
    scanPendingCardDates(NOW);
    expect(resolveCardReview(unclear.id, { kind: "birthday" }, LATER)).toBe("duplicate");
    expect(listDatesFor("c1", LATER)).toHaveLength(1);
    expect(scanOf(unclear.id)).toMatchObject({ outcome: "duplicate", date_id: null });
    expect(listCardReviews()).toEqual([]);
  });

  it("leaves out a review whose customer is gone", async () => {
    seedCustomer("c2", "Bea", "5165550222");
    await saved({ customerId: "c2", contact: { name: "Bea", phone: "5165550222" }, fulfillment: delivery("Happy 25th!") });
    scanPendingCardDates(NOW);
    expect(listCardReviews()).toHaveLength(1);
    getDb().prepare("DELETE FROM customers WHERE id = 'c2'").run();
    expect(listCardReviews()).toEqual([]);
  });
});
