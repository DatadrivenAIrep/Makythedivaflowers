import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { dateResults } from "@/lib/date-results";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const NOW = new Date("2026-12-01T12:00:00Z");
const day = (n: number, hours = 0) => new Date(NOW.getTime() - 86400_000 * 30 + n * 86400_000 + hours * 3600_000).toISOString();

function customer(id: string, opts: { tag?: boolean; stoppedAt?: string } = {}) {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at, sms_stopped_at)
     VALUES (?, 'N', ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?)`,
  ).run(id, `555${id}`, opts.stoppedAt ?? null);
  if (opts.tag) getDb().prepare("INSERT INTO customer_tags (customer_id, tag) VALUES (?, 'sms-marketing')").run(id);
}
function date(id: string, customerId: string, source = "customer", createdAt = day(0)) {
  getDb().prepare(
    `INSERT INTO customer_important_dates (id, customer_id, kind, label, month, day, created_at, source)
     VALUES (?, ?, 'birthday', 'M', 3, 15, ?, ?)`,
  ).run(id, customerId, createdAt, source);
}
function send(dateId: string, stage: "d7" | "d3", status: "sent" | "skipped", at: string) {
  getDb().prepare(
    `INSERT INTO date_reminder_sends (date_id, occurrence_date, stage, status, recorded_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(dateId, `2027-03-15-${stage}-${at}`, stage, status, at);
}
function order(id: string, customerId: string, createdAt: string, total: number, opts: { payment?: string; fulfillment?: string } = {}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, customer_id,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents,
       fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'web', 'R', '1', '1', ?, 'pickup', '2026-06-01', '[]', 0, 0, 0, ?, ?, ?, ?, ?)`,
  ).run(id, customerId, total, opts.fulfillment ?? "pending", opts.payment ?? "paid", createdAt, createdAt);
}

describe("dateResults", () => {
  it("atribuye al último mensaje dentro de 10 días", () => {
    customer("1"); date("d1", "1");
    send("d1", "d7", "sent", day(1));
    send("d1", "d3", "sent", day(5));
    order("o1", "1", day(6), 4500);
    const r = dateResults(NOW);
    expect(r.stages.d3).toEqual({ sent: 1, skipped: 0, orders: 1, revenueCents: 4500 });
    expect(r.stages.d7).toEqual({ sent: 1, skipped: 0, orders: 0, revenueCents: 0 });
  });

  it("no atribuye a los 11 días ni pedidos cancelados ni omitidos", () => {
    customer("1"); date("d1", "1");
    send("d1", "d7", "sent", day(1));
    order("late", "1", day(12), 1000);                                   // 11 days after
    order("canceled", "1", day(3), 1000, { fulfillment: "canceled" });
    order("unpaid", "1", day(3), 1000, { payment: "pending" });
    customer("2"); date("d2", "2");
    send("d2", "d3", "skipped", day(1));
    order("o2", "2", day(2), 1000);                                       // only a skipped row
    const r = dateResults(NOW);
    expect(r.stages.d7.orders).toBe(0);
    expect(r.stages.d3.orders).toBe(0);
    expect(r.stages.d3.skipped).toBe(1);
  });

  it("cuenta cada pedido una sola vez aunque haya varias fechas", () => {
    customer("1"); date("d1", "1"); date("d2", "1");
    send("d1", "d7", "sent", day(1));
    send("d2", "d3", "sent", day(2));
    order("o1", "1", day(3), 2000);
    const r = dateResults(NOW);
    expect(r.stages.d7.orders + r.stages.d3.orders).toBe(1);
    expect(r.stages.d3.orders).toBe(1);
  });

  it("cuenta STOP dentro de 48 horas", () => {
    customer("1", { stoppedAt: day(1, 30) }); date("d1", "1"); send("d1", "d7", "sent", day(1));
    customer("2", { stoppedAt: day(1, 50) }); date("d2", "2"); send("d2", "d7", "sent", day(1));
    expect(dateResults(NOW).stopsWithin48h).toBe(1);
  });

  it("solo cuenta fechas del cliente", () => {
    customer("1", { tag: true }); date("d1", "1", "customer");
    customer("2", { tag: true }); date("d2", "2", "admin");
    customer("3"); date("d3", "3", "customer");
    const r = dateResults(NOW);
    expect(r.customersWithOwnDates).toBe(2);
    expect(r.withSms).toBe(1);
  });

  it("solo cuenta fechas propias creadas en los últimos 90 días", () => {
    const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86400_000).toISOString();
    customer("1", { tag: true }); date("d1", "1", "customer", at(89));
    customer("2", { tag: true }); date("d2", "2", "customer", at(91));
    customer("3"); date("d3", "3", "customer", at(200)); date("d4", "3", "customer", at(10));
    const r = dateResults(NOW);
    expect(r.customersWithOwnDates).toBe(2);
    expect(r.withSms).toBe(1);
  });
});
