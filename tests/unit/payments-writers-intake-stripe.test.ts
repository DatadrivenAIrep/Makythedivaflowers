import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

vi.mock("@/lib/stripe-server", () => ({
  stripe: { checkout: { sessions: { create: vi.fn() } } },
}));

import { POST } from "@/app/api/admin/orders/route";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { updateOrderStatusByPaymentIntent, updateOrderPaidByCheckoutSession } from "@/lib/order-storage";

const ORDER_FILE = path.join(os.tmpdir(), `diva-payrows-orders-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-payrows-print-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", ORDER_FILE);
  vi.stubEnv("PRINT_QUEUE_FILE", PRINT_FILE);
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  await fs.writeFile(ORDER_FILE, "[]");
  await fs.writeFile(PRINT_FILE, "[]");
});
afterEach(async () => {
  closeDb();
  vi.unstubAllEnvs();
  try { await fs.unlink(ORDER_FILE); } catch {}
  try { await fs.unlink(PRINT_FILE); } catch {}
});

const base = {
  source: "phone" as const,
  customer: { phone: "5165550100", name: "Maria", messagingChannel: "none" as const },
  fulfillment: { method: "in-store" as const, recipient: { name: "", phone: "" } },
  lines: [{ kind: "custom" as const, title: "Evento", priceCents: 50000, qty: 1 }],
};

function req(b: unknown): Request {
  return new Request("http://localhost/api/admin/orders", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
  });
}

type PayRow = { kind: string; method: string; amount: number; source: string };
const payRows = () =>
  getDb().prepare("SELECT kind, method, amount_cents AS amount, source FROM payments ORDER BY rowid").all() as PayRow[];

describe("intake logs the money that moved", () => {
  it("an intake paid in cash logs one payment for the total", async () => {
    const res = await POST(req({ ...base, payment: { status: "paid", method: "cash" } }));
    expect(res.status).toBe(201);
    const rows = payRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "payment", method: "cash", source: "intake" });
    expect(rows[0].amount).toBeGreaterThan(50000 - 1); // the total, tax included
  });

  it("an intake with a deposit logs the deposit only", async () => {
    await POST(req({ ...base, payment: { status: "pending", deposit: { amountCents: 10000, method: "zelle" } } }));
    expect(payRows()).toEqual([{ kind: "deposit", method: "zelle", amount: 10000, source: "intake" }]);
  });

  it("a pending intake without money logs nothing", async () => {
    await POST(req({ ...base, payment: { status: "pending" } }));
    expect(payRows()).toEqual([]);
  });
});

function insertOrder(id: string, over: { pi?: string; cs?: string; gift?: number; giftId?: string } = {}) {
  const now = new Date().toISOString();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents,
       fulfillment_status, payment_status, stripe_payment_intent_id, stripe_checkout_session_id,
       gift_card_cents, gift_card_id, created_at, updated_at)
     VALUES (?, 'es', 'web', 'Ana', '5165550100', '5165550100', 'in-store', '[]', 10000, 0, 0, 10000, 0,
       'pending', 'pending', ?, ?, ?, ?, ?, ?)`,
  ).run(id, over.pi ?? null, over.cs ?? null, over.gift ?? null, over.giftId ?? null, now, now);
}

describe("stripe logs the money that moved", () => {
  beforeEach(() => { runMigrations(); });

  it("a paid payment intent splits gift card and stripe, once", async () => {
    insertOrder("o1", { pi: "pi_1", gift: 2500, giftId: "gc_1" });
    await updateOrderStatusByPaymentIntent("pi_1", "paid");
    await updateOrderStatusByPaymentIntent("pi_1", "paid"); // webhook retry
    expect(payRows()).toEqual([
      { kind: "payment", method: "gift-card", amount: 2500, source: "stripe_intent" },
      { kind: "payment", method: "stripe", amount: 7500, source: "stripe_intent" },
    ]);
  });

  it("a non-paid status change logs nothing", async () => {
    insertOrder("o3", { pi: "pi_3" });
    await updateOrderStatusByPaymentIntent("pi_3", "preparing");
    expect(payRows()).toEqual([]);
  });

  it("a paid checkout session logs stripe once", async () => {
    insertOrder("o2", { cs: "cs_1" });
    await updateOrderPaidByCheckoutSession("cs_1");
    await updateOrderPaidByCheckoutSession("cs_1");
    expect(payRows()).toEqual([{ kind: "payment", method: "stripe", amount: 10000, source: "stripe_checkout" }]);
  });
});
