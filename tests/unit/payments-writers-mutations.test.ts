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
});
