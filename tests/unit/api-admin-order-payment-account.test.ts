import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { createAccount } from "@/lib/house-account-storage";
import { recordCharge } from "@/lib/house-account-ledger";
import { PATCH } from "@/app/api/admin/orders/[id]/payment/route";
import { GET } from "@/app/api/admin/orders/[id]/route";
import { POST as postPaymentLink } from "@/app/api/admin/orders/[id]/payment-link/route";
import { POST as postResend } from "@/app/api/admin/orders/[id]/resend/route";

const createCheckoutSession = vi.hoisted(() => vi.fn());
const dispatchOrderReceived = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe-payment-link", () => ({ createCheckoutSession }));
vi.mock("@/lib/order-dispatch", () => ({ dispatchOrderReceived, dispatchPaymentConfirmed: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-pay-acct-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, accountId: string | null = null, paid = 0) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '5165550100', 'in-store', NULL, '[]', 5000, 0, 0, 5000, ?, 'pending',
       'pending', ?, ?, '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z')`,
  ).run(id, paid, accountId ? "house-account" : null, accountId);
}
const patch = (id: string, body: unknown) => PATCH(
  new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json", cookie: `intake_session=${signSession()}` }, body: JSON.stringify(body) }),
  { params: Promise.resolve({ id }) },
);
const get = (id: string) => GET(new Request("http://x"), { params: Promise.resolve({ id }) });

describe("PATCH /api/admin/orders/[id]/payment · house account", () => {
  it("moveToAccount charges the remaining balance; detail shows the account", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o1", null, 1000);
    const res = await patch("o1", { moveToAccount: { accountId: a.id } });
    expect(res.status).toBe(200);
    const { order } = await res.json();
    expect(order).toMatchObject({ houseAccountId: a.id, paymentMethod: "house-account", paymentStatus: "pending" });
    const detail = await (await get("o1")).json();
    expect(detail.houseAccount).toEqual({ id: a.id, name: "Hotel", billed: false });
    expect((await patch("o1", { moveToAccount: { accountId: a.id } })).status).toBe(409);
    expect((await patch("o2", { moveToAccount: { accountId: "ha_nope" } })).status).toBe(404);
  });
  it("order-level payment actions on an account order are refused with 409 on_account", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o1", a.id);
    recordCharge({ accountId: a.id, orderId: "o1", amountCents: 5000, actor: "m" });
    for (const body of [
      { method: "cash" },
      { deposit: { amountCents: 1000, method: "cash" } },
      { settleBalance: true },
    ]) {
      const res = await patch("o1", body);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "on_account" });
    }
    expect(getDb().prepare("SELECT amount_paid_cents, payment_status FROM orders WHERE id = 'o1'").get())
      .toEqual({ amount_paid_cents: 0, payment_status: "pending" });
  });
  it("payment links are refused for an account order before any session or send", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o1", a.id);
    const ctx = { params: Promise.resolve({ id: "o1" }) };
    const link = await postPaymentLink(new Request("http://x", { method: "POST" }), ctx);
    expect(link.status).toBe(409);
    expect(await link.json()).toEqual({ error: "on_account" });
    const resend = await postResend(
      new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "payment_link" }) }),
      { params: Promise.resolve({ id: "o1" }) },
    );
    expect(resend.status).toBe(409);
    expect(await resend.json()).toEqual({ error: "on_account" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(dispatchOrderReceived).not.toHaveBeenCalled();
  });
  it("removeFromAccount clears the order while unbilled; 409 once billed", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o1", a.id);
    const e = recordCharge({ accountId: a.id, orderId: "o1", amountCents: 5000, actor: "m" });
    const ok = await patch("o1", { removeFromAccount: true });
    expect(ok.status).toBe(200);
    expect((await ok.json()).order.houseAccountId).toBeUndefined();
    seed("o2", a.id);
    const e2 = recordCharge({ accountId: a.id, orderId: "o2", amountCents: 5000, actor: "m" });
    getDb().prepare("UPDATE house_account_entries SET statement_id = 'hst_x' WHERE id = ?").run(e2.id);
    expect((await patch("o2", { removeFromAccount: true })).status).toBe(409);
    expect((await (await get("o2")).json()).houseAccount.billed).toBe(true);
    void e;
  });
});
