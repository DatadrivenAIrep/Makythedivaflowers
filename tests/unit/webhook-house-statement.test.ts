import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, accountBalanceCents } from "@/lib/house-account-storage";
import { recordCharge } from "@/lib/house-account-ledger";

const constructEvent = vi.fn();
vi.mock("@/lib/stripe-server", () => ({ stripe: { webhooks: { constructEvent } } }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn() }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn() }));
vi.mock("@/lib/order-dispatch", () => ({ dispatchPaymentConfirmed: vi.fn() }));
vi.mock("@/lib/on-web-order-paid", () => ({ onWebOrderPaid: vi.fn() }));
vi.mock("@/lib/analytics-server", () => ({ sendPurchaseToGA4: vi.fn() }));

const TEST_FILE = path.join(os.tmpdir(), `diva-test-orders-hs-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dummy");
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  constructEvent.mockReset();
  runMigrations();
});
afterEach(async () => { try { await fs.unlink(TEST_FILE); } catch {} closeDb(); vi.unstubAllEnvs(); });

function seedOrder(id: string, accountId: string, total: number) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, order_number, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'Dest', '555', '5165550100', 'delivery', '2026-10-01', '[]', ?, 0, 0, ?, 0, 'pending',
       'pending', 'house-account', ?, 1001, '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z')`,
  ).run(id, total, total, accountId);
}
function seedStatement(accountId: string) {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
  ).run(accountId);
}
async function post(event: unknown) {
  constructEvent.mockReturnValue(event);
  const { POST } = await import("@/app/api/stripe/webhook/route");
  return POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "sig" }, body: "{}" }));
}

describe("webhook: house statement", () => {
  it("records the payment once, pays the order and settles the statement", async () => {
    const a = createAccount({ name: "Hotel" });
    seedOrder("o1", a.id, 7000);
    recordCharge({ accountId: a.id, orderId: "o1", amountCents: 7000, actor: "m" });
    seedStatement(a.id);
    const event = {
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", amount_total: 7000, metadata: { kind: "house_statement", statementId: "hst_1", accountId: a.id } } },
    };
    expect((await post(event)).status).toBe(200);
    expect((await post(event)).status).toBe(200); // replay
    const entries = getDb().prepare("SELECT kind, amount_cents, method, stripe_session_id FROM house_account_entries WHERE kind = 'payment'").all();
    expect(entries).toEqual([{ kind: "payment", amount_cents: -7000, method: "stripe", stripe_session_id: "cs_1" }]);
    expect(accountBalanceCents(a.id)).toBe(0);
    expect((getDb().prepare("SELECT status FROM house_account_statements WHERE id = 'hst_1'").get() as { status: string }).status).toBe("paid");
    expect((getDb().prepare("SELECT payment_status FROM orders WHERE id = 'o1'").get() as { payment_status: string }).payment_status).toBe("paid");
  });
  it("ignores a payment_intent.succeeded for a statement (no order lookup, no crash)", async () => {
    const res = await post({ type: "payment_intent.succeeded", data: { object: { id: "pi_hs", metadata: { kind: "house_statement", statementId: "hst_1" } } } });
    expect(res.status).toBe(200);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM house_account_entries").get()).toEqual({ n: 0 });
  });
});
