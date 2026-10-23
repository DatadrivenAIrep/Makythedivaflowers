import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { insertMessage, updateMessage } from "@/lib/message-storage";
import { getReceivables } from "@/lib/order-receivables";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

// Noon in New York on 2026-10-13: the shop's "today".
const NOW = new Date("2026-10-13T16:00:00Z");

type Seed = {
  id: string;
  method?: "delivery" | "pickup" | "in-store";
  date?: string | null;
  createdAt?: string;
  source?: string;
  status?: string;
  payment?: string;
  total?: number;
  paid?: number;
  account?: string | null;
  number?: number;
};

function seed(s: Seed) {
  const method = s.method ?? "delivery";
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, contact_name,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, amount_paid_cents, fulfillment_status, payment_status, house_account_id,
       order_number, created_at, updated_at)
     VALUES (?, 'en', ?, 'Ana', '555', '5165551234', 'Robyn Lee', ?, ?, ?, '[]', 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    s.id, s.source ?? "phone", method,
    method === "in-store" ? null : (s.date ?? "2026-10-10"),
    method === "in-store" ? null : "morning",
    s.total ?? 10000, s.paid ?? 0, s.status ?? "delivered", s.payment ?? "pending", s.account ?? null,
    s.number ?? null, s.createdAt ?? "2026-10-01T15:00:00Z", s.createdAt ?? "2026-10-01T15:00:00Z",
  );
}

describe("getReceivables", () => {
  it("lists past orders that still owe money, oldest first", () => {
    seed({ id: "edited", date: "2026-10-09", payment: "paid", paid: 8000, number: 1001 });
    seed({ id: "unpaid", date: "2026-10-10", number: 1002 });
    seed({ id: "instore", method: "in-store", createdAt: "2026-10-11T20:00:00Z", number: 1003 });
    seed({ id: "deposit", method: "pickup", date: "2026-10-12", paid: 4000, number: 1004 });

    const r = getReceivables(NOW);
    expect(r.items.map((i) => i.orderId)).toEqual(["edited", "unpaid", "instore", "deposit"]);
    expect(r.totalCents).toBe(2000 + 10000 + 10000 + 6000);

    const unpaid = r.items[1];
    expect(unpaid).toMatchObject({
      orderNumber: 1002, buyerName: "Robyn Lee", phone: "5165551234",
      dueDate: "2026-10-10", daysOverdue: 3, balanceCents: 10000, canRemind: true, method: "delivery",
    });
    expect(r.items[2]).toMatchObject({ dueDate: "2026-10-11", method: "in-store" });
    expect(r.items[3]).toMatchObject({ balanceCents: 6000, canRemind: true });
  });

  it("can't remind an order already marked paid — Stripe would not record a second payment", () => {
    seed({ id: "edited", payment: "paid", paid: 8000 });
    expect(getReceivables(NOW).items[0]).toMatchObject({ balanceCents: 2000, canRemind: false });
  });

  it("leaves out today, paid, account, canceled, refunded and failed web checkouts", () => {
    seed({ id: "today", date: "2026-10-13" });
    seed({ id: "instore-today", method: "in-store", createdAt: "2026-10-13T14:00:00Z" });
    seed({ id: "paid", payment: "paid", paid: 10000 });
    seed({ id: "account", account: "ha_1" });
    seed({ id: "canceled", status: "canceled" });
    seed({ id: "refunded", payment: "refunded", paid: 0 });
    seed({ id: "web-failed", source: "web", payment: "failed" });
    expect(getReceivables(NOW).items).toEqual([]);
    expect(getReceivables(NOW).totalCents).toBe(0);
  });

  it("uses the shop's calendar day: 11pm in New York is still that day", () => {
    // 2026-10-13T03:00Z is 11pm on 10-12 in New York — not yet past.
    seed({ id: "late", method: "in-store", createdAt: "2026-10-13T03:00:00Z" });
    expect(getReceivables(new Date("2026-10-13T03:30:00Z")).items).toEqual([]);
    expect(getReceivables(NOW).items.map((i) => i.dueDate)).toEqual(["2026-10-12"]);
  });

  it("carries the last successful reminder", () => {
    seed({ id: "unpaid" });
    const failed = insertMessage({ orderId: "unpaid", channel: "sms", template: "payment_reminder", locale: "en", toPhone: "5165551234" });
    updateMessage(failed, { status: "failed", error: "x" });
    expect(getReceivables(NOW).items[0].lastReminderAt).toBeUndefined();
    const ok = insertMessage({ orderId: "unpaid", channel: "sms", template: "payment_reminder", locale: "en", toPhone: "5165551234" });
    updateMessage(ok, { status: "sent", providerSid: "SM1" });
    expect(getReceivables(NOW).items[0].lastReminderAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
