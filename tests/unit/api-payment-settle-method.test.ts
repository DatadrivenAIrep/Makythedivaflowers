import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { PATCH } from "@/app/api/admin/orders/[id]/payment/route";

vi.mock("@/lib/order-dispatch", () => ({ dispatchPaymentConfirmed: vi.fn(), dispatchDelivered: vi.fn(), dispatchOutForDelivery: vi.fn() }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-settle-method-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents,
       fulfillment_status, payment_status, created_at, updated_at)
     VALUES ('o1', 'es', 'phone', 'Ana', '5165550100', '5165550100', 'in-store', '[]', 10000, 0, 0, 10000, 4000,
       'pending', 'pending', '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z')`,
  ).run();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const patch = (body: unknown) => PATCH(
  new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json", cookie: `intake_session=${signSession()}` }, body: JSON.stringify(body) }),
  { params: Promise.resolve({ id: "o1" }) },
);
const rows = () => getDb().prepare("SELECT kind, method, amount_cents AS amount, source FROM payments ORDER BY rowid").all();

describe("PATCH payment · settleBalance with a method", () => {
  it.each(["cash", "zelle", "card-terminal", "ach", "check"])("%s is routed to settleBalance, not markPaidManual", async (method) => {
    const res = await patch({ settleBalance: true, method });
    expect(res.status).toBe(200);
    expect(rows()).toEqual([{ kind: "balance", method, amount: 6000, source: "settle" }]);
    const o = getDb().prepare("SELECT payment_status, amount_paid_cents FROM orders WHERE id='o1'").get();
    expect(o).toEqual({ payment_status: "pending", amount_paid_cents: 10000 });
  });
});
