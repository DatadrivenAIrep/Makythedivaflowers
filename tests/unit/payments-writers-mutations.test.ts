import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { markPaidManual, recordDeposit, settleBalance, cancelOrder } from "@/lib/order-mutations";

vi.mock("@/lib/order-dispatch", () => ({ dispatchPaymentConfirmed: vi.fn(), dispatchDelivered: vi.fn(), dispatchOutForDelivery: vi.fn() }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn() }));

function insertOrder(id: string, over: { total?: number; paid?: number; status?: string; method?: string } = {}) {
  const now = new Date().toISOString();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents,
       fulfillment_status, payment_status, payment_method, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'Ana', '5165550100', '5165550100', 'in-store', '[]', ?, 0, 0, ?, ?, 'pending', ?, ?, ?, ?)`,
  ).run(id, over.total ?? 10000, over.total ?? 10000, over.paid ?? 0, over.status ?? "pending", over.method ?? null, now, now);
}
function insertPayment(orderId: string, kind: string, method: string, amount: number) {
  const at = new Date().toISOString();
  getDb().prepare(
    `INSERT INTO payments (id, at, day, kind, method, amount_cents, order_id, source, actor)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'test', 'maky')`,
  ).run(`pay_${Math.random().toString(36).slice(2)}`, at, at.slice(0, 10), kind, method, amount, orderId);
}
const refundRows = (orderId: string) => getDb().prepare(
  "SELECT kind, method, amount_cents AS amount, source FROM payments WHERE order_id = ? AND kind = 'refund' ORDER BY method",
).all(orderId);
const rows = () => getDb().prepare("SELECT kind, method, amount_cents AS amount, source FROM payments ORDER BY rowid").all();

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); vi.stubEnv("TWILIO_DRY_RUN", "true"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("money writers in order-mutations", () => {
  it("mark paid logs the full amount once", async () => {
    insertOrder("o1");
    await markPaidManual("o1", { method: "cash" });
    await markPaidManual("o1", { method: "cash" }); // already paid: no second row
    expect(rows()).toEqual([{ kind: "payment", method: "cash", amount: 10000, source: "mark_paid" }]);
  });

  it("a deposit, then mark paid, logs the deposit and only the remainder", async () => {
    insertOrder("o2");
    await recordDeposit("o2", { amountCents: 3000, method: "zelle" }, "maky");
    await markPaidManual("o2", { method: "cash" });
    expect(rows()).toEqual([
      { kind: "deposit", method: "zelle", amount: 3000, source: "deposit" },
      { kind: "balance", method: "cash", amount: 7000, source: "mark_paid" },
    ]);
  });

  it("settle logs the remainder with the method, or unknown without one", async () => {
    insertOrder("o3", { paid: 4000 });
    await settleBalance("o3", "maky", "card-terminal");
    insertOrder("o4", { paid: 9000 });
    await settleBalance("o4", "maky");
    expect(rows()).toEqual([
      { kind: "balance", method: "card-terminal", amount: 6000, source: "settle" },
      { kind: "balance", method: "unknown", amount: 1000, source: "settle" },
    ]);
  });

  it("a refunded cancel logs a negative row in the method it was paid", async () => {
    insertOrder("o5", { paid: 10000, status: "paid", method: "zelle" });
    await cancelOrder("o5", { refund: true });
    expect(rows()).toEqual([{ kind: "refund", method: "zelle", amount: -10000, source: "cancel_refund" }]);
  });

  it("a refund nets the order's logged money per method (gift card + cash)", async () => {
    insertOrder("o6", { paid: 10000, status: "paid", method: "cash" });
    insertPayment("o6", "payment", "gift-card", 3000);
    insertPayment("o6", "payment", "cash", 7000);
    await cancelOrder("o6", { refund: true });
    expect(refundRows("o6")).toEqual([
      { kind: "refund", method: "cash", amount: -7000, source: "cancel_refund" },
      { kind: "refund", method: "gift-card", amount: -3000, source: "cancel_refund" },
    ]);
  });

  it("a refund after a zelle deposit and a stripe balance returns each in its own method", async () => {
    insertOrder("o7", { paid: 10000, status: "paid", method: "stripe" });
    insertPayment("o7", "deposit", "zelle", 5000);
    insertPayment("o7", "balance", "stripe", 5000);
    await cancelOrder("o7", { refund: true });
    expect(refundRows("o7")).toEqual([
      { kind: "refund", method: "stripe", amount: -5000, source: "cancel_refund" },
      { kind: "refund", method: "zelle", amount: -5000, source: "cancel_refund" },
    ]);
  });

  it("a paid order with no logged rows and no amount paid refunds total minus gift card", async () => {
    insertOrder("o8", { total: 9000, paid: 0, status: "paid", method: "card-terminal" });
    getDb().prepare("UPDATE orders SET gift_card_cents = 2000 WHERE id = 'o8'").run();
    await cancelOrder("o8", { refund: true });
    expect(rows()).toEqual([{ kind: "refund", method: "card-terminal", amount: -7000, source: "cancel_refund" }]);
  });

  it("settling a credit logs the money handed back as a refund", async () => {
    insertOrder("o9", { total: 8000, paid: 10000 });
    await settleBalance("o9", "maky", "cash");
    expect(rows()).toEqual([{ kind: "refund", method: "cash", amount: -2000, source: "settle" }]);
  });
});
