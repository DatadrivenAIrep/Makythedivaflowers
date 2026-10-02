// tests/unit/house-account-ledger.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, accountBalanceCents, updateAccount } from "@/lib/house-account-storage";
import {
  recordCharge, recordPayment, recordCredit, recordAdjustment, reverseOrderCharge, syncOrderTotal,
  moveOrderToAccount, removeOrderFromAccount, recordStripeStatementPayment, listEntries,
} from "@/lib/house-account-ledger";
import { recomputeSettlement, dueCents } from "@/lib/house-account-settlement";
import { enqueue, getSend } from "@/lib/house-account-sends";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

type OrderSeed = { id: string; total: number; paid?: number; accountId?: string | null; createdAt?: string; status?: string; payment?: string };
function seedOrder(o: OrderSeed) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, order_number, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'Dest', '555', '5165550100', 'delivery', '2026-10-01', '[]', ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    o.id, o.total, o.total, o.paid ?? 0, o.status ?? "pending", o.payment ?? "pending",
    o.accountId ? "house-account" : null, o.accountId ?? null, Number(o.id.replace(/\D/g, "")) || 1000,
    o.createdAt ?? "2026-09-10T12:00:00Z", o.createdAt ?? "2026-09-10T12:00:00Z",
  );
}
function order(id: string) {
  return getDb().prepare("SELECT * FROM orders WHERE id = ?").get(id) as {
    amount_paid_cents: number; payment_status: string; paid_at: string | null; house_account_id: string | null; payment_method: string | null;
  };
}
function seedStatement(accountId: string, id: string, periodEnd: string, closing: number) {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES (?, ?, ?, ?, '2026-09-01', ?, '2026-10-01T13:00:00Z', '2026-10-16', 0, ?, 0, 0, ?, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
  ).run(id, accountId, `ST-${id}`, id.padEnd(8, "x").slice(0, 8), periodEnd, closing, closing);
}
function statement(id: string) {
  return getDb().prepare("SELECT status, settled_cents AS settledCents, closing_cents AS closingCents FROM house_account_statements WHERE id = ?").get(id) as
    { status: string; settledCents: number; closingCents: number };
}

describe("charges and payments", () => {
  it("recordCharge adds a positive entry tied to the order", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, accountId: a.id });
    const e = recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 5000, actor: "maky" });
    expect(e).toMatchObject({ kind: "charge", amountCents: 5000, orderId: "o1001" });
    expect(accountBalanceCents(a.id)).toBe(5000);
    expect(() => recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 0, actor: "maky" })).toThrow("invalid_amount");
    expect(() => recordCharge({ accountId: "ha_nope", orderId: "o1001", amountCents: 1, actor: "maky" })).toThrow("account_not_found");
  });

  it("recordPayment allocates FIFO to open orders and marks the covered ones paid", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    seedOrder({ id: "o1002", total: 3000, accountId: a.id, createdAt: "2026-09-11T12:00:00Z" });
    seedOrder({ id: "o1003", total: 2000, accountId: a.id, createdAt: "2026-09-12T12:00:00Z" });
    for (const [id, c] of [["o1001", 5000], ["o1002", 3000], ["o1003", 2000]] as const) {
      recordCharge({ accountId: a.id, orderId: id, amountCents: c, actor: "maky" });
    }
    const r = recordPayment({ accountId: a.id, amountCents: 6500, method: "zelle", actor: "maky" });
    expect(r.entry).toMatchObject({ kind: "payment", amountCents: -6500, method: "zelle" });
    expect(r.allocations).toEqual([{ id: "o1001", appliedCents: 5000 }, { id: "o1002", appliedCents: 1500 }]);
    expect(order("o1001")).toMatchObject({ amount_paid_cents: 5000, payment_status: "paid", payment_method: "house-account" });
    expect(order("o1001").paid_at).toBeTruthy();
    expect(order("o1002")).toMatchObject({ amount_paid_cents: 1500, payment_status: "pending" });
    expect(order("o1003")).toMatchObject({ amount_paid_cents: 0, payment_status: "pending" });
    expect(accountBalanceCents(a.id)).toBe(3500);
    const changes = getDb().prepare("SELECT order_id, kind, summary FROM order_changes ORDER BY rowid").all() as { order_id: string; kind: string; summary: string }[];
    expect(changes.filter((c) => c.kind === "payment").map((c) => c.order_id)).toEqual(["o1001", "o1002"]);
    expect(changes[0].summary).toContain("$50.00");
  });

  it("overpayment pays every order and leaves credit on the account", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 1000, accountId: a.id });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 1000, actor: "maky" });
    const r = recordPayment({ accountId: a.id, amountCents: 1500, method: "cash", actor: "maky" });
    expect(r.allocations).toEqual([{ id: "o1001", appliedCents: 1000 }]);
    expect(accountBalanceCents(a.id)).toBe(-500);
  });

  it("validates payments", () => {
    const a = createAccount({ name: "Org" });
    expect(() => recordPayment({ accountId: a.id, amountCents: -5, method: "cash", actor: "m" })).toThrow("invalid_amount");
    expect(() => recordPayment({ accountId: a.id, amountCents: 5, method: "crypto" as never, actor: "m" })).toThrow("invalid_method");
    expect(() => recordCredit({ accountId: a.id, amountCents: 5, note: "  ", actor: "m" })).toThrow("note_required");
  });

  it("a new charge on an account in credit is paid from that credit", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 1000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 1000, actor: "maky" });
    recordPayment({ accountId: a.id, amountCents: 1600, method: "cash", actor: "maky" }); // 600 credit
    expect(accountBalanceCents(a.id)).toBe(-600);
    seedOrder({ id: "o1002", total: 400, accountId: a.id, createdAt: "2026-09-11T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 400, actor: "maky" });
    expect(order("o1002")).toMatchObject({ amount_paid_cents: 400, payment_status: "paid" });
    expect(accountBalanceCents(a.id)).toBe(-200);
    seedOrder({ id: "o1003", total: 500, accountId: a.id, createdAt: "2026-09-12T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1003", amountCents: 500, actor: "maky" });
    expect(order("o1003")).toMatchObject({ amount_paid_cents: 200, payment_status: "pending" });
    expect(accountBalanceCents(a.id)).toBe(300);
  });

  it("recordCredit allocates like a payment", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 1000, accountId: a.id });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 1000, actor: "maky" });
    const r = recordCredit({ accountId: a.id, amountCents: 1000, note: "cortesía", actor: "maky" });
    expect(r.entry?.kind).toBe("credit");
    expect(order("o1001").payment_status).toBe("paid");
    expect(accountBalanceCents(a.id)).toBe(0);
  });
});

describe("adjustments, reversals, edits", () => {
  it("an order-edit adjustment never pays another order, but marks its own when covered", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    seedOrder({ id: "o1002", total: 1000, paid: 800, accountId: a.id, createdAt: "2026-09-11T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 5000, actor: "maky" });
    recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 200, actor: "maky" });
    // o1002's total drops from 1000 to 800: the order is now covered by its deposit.
    getDb().prepare("UPDATE orders SET total_cents = 800 WHERE id = 'o1002'").run();
    const e = syncOrderTotal("o1002", 1000, 800, "maky");
    expect(e).toMatchObject({ kind: "adjustment", amountCents: -200, orderId: "o1002" });
    expect(order("o1002").payment_status).toBe("paid");
    expect(order("o1001")).toMatchObject({ amount_paid_cents: 0, payment_status: "pending" });
    expect(syncOrderTotal("o1002", 800, 800, "maky")).toBeNull();
    expect(accountBalanceCents(a.id)).toBe(5000);
  });

  it("manual adjustment requires a note and a non-zero amount", () => {
    const a = createAccount({ name: "Org" });
    expect(() => recordAdjustment({ accountId: a.id, amountCents: 0, note: "x", actor: "m" })).toThrow("invalid_amount");
    expect(() => recordAdjustment({ accountId: a.id, amountCents: 100, note: "", actor: "m" })).toThrow("note_required");
    expect(recordAdjustment({ accountId: a.id, amountCents: 250, note: "recargo", actor: "m" }).amountCents).toBe(250);
  });

  it("reversal happens once and frees only the canceled order's paid amount", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 10000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    seedOrder({ id: "o1002", total: 5000, accountId: a.id, createdAt: "2026-09-11T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 10000, actor: "maky" });
    recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 5000, actor: "maky" });
    // Nothing paid yet: the reversal must not touch o1002.
    getDb().prepare("UPDATE orders SET fulfillment_status = 'canceled' WHERE id = 'o1001'").run();
    const r1 = reverseOrderCharge("o1001", "maky");
    expect(r1).toMatchObject({ kind: "reversal", amountCents: -10000, orderId: "o1001" });
    expect(order("o1002")).toMatchObject({ amount_paid_cents: 0, payment_status: "pending" });
    expect(accountBalanceCents(a.id)).toBe(5000);
    expect(reverseOrderCharge("o1001", "maky")).toBeNull();
    expect(reverseOrderCharge("o_unknown", "maky")).toBeNull();
  });

  it("reversal of a paid order frees its money to the next open order", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 1000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    seedOrder({ id: "o1002", total: 500, accountId: a.id, createdAt: "2026-09-11T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 1000, actor: "maky" });
    recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 500, actor: "maky" });
    recordPayment({ accountId: a.id, amountCents: 1000, method: "cash", actor: "maky" }); // pays o1001
    getDb().prepare("UPDATE orders SET fulfillment_status = 'canceled' WHERE id = 'o1001'").run();
    reverseOrderCharge("o1001", "maky");
    expect(order("o1002")).toMatchObject({ amount_paid_cents: 500, payment_status: "paid" });
    expect(accountBalanceCents(a.id)).toBe(-500);
  });
});

describe("reversal deposits", () => {
  it("reversal of a moved order does not spend a deposit that never reached the ledger", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, paid: 1000, createdAt: "2026-09-10T12:00:00Z" }); // $10 cash deposit, then moved
    seedOrder({ id: "o1002", total: 500, accountId: a.id, createdAt: "2026-09-11T12:00:00Z" });
    moveOrderToAccount("o1001", a.id, "maky"); // charge 4000
    recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 500, actor: "maky" });
    getDb().prepare("UPDATE orders SET fulfillment_status = 'canceled' WHERE id = 'o1001'").run();
    const r = reverseOrderCharge("o1001", "maky");
    expect(r).toMatchObject({ kind: "reversal", amountCents: -4000 });
    expect(order("o1002")).toMatchObject({ amount_paid_cents: 0, payment_status: "pending" }); // the $10 deposit stays with o1001
    expect(accountBalanceCents(a.id)).toBe(500);
  });
});

describe("move / remove", () => {
  it("moveOrderToAccount charges the remaining balance and tags the order", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, paid: 1000 });
    const e = moveOrderToAccount("o1001", a.id, "maky");
    expect(e).toMatchObject({ kind: "charge", amountCents: 4000, orderId: "o1001" });
    expect(order("o1001")).toMatchObject({ house_account_id: a.id, payment_method: "house-account", payment_status: "pending" });
    expect(() => moveOrderToAccount("o1001", a.id, "maky")).toThrow("already_on_account");
    const kinds = (getDb().prepare("SELECT kind FROM order_changes WHERE order_id = 'o1001'").all() as { kind: string }[]).map((k) => k.kind);
    expect(kinds).toContain("house_account");
  });
  it("refuses paid, canceled, fully-paid and inactive-account moves", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, payment: "paid", paid: 5000 });
    expect(() => moveOrderToAccount("o1001", a.id, "maky")).toThrow("not_pending");
    seedOrder({ id: "o1002", total: 5000, status: "canceled" });
    expect(() => moveOrderToAccount("o1002", a.id, "maky")).toThrow("not_pending");
    seedOrder({ id: "o1003", total: 5000, paid: 5000 });
    expect(() => moveOrderToAccount("o1003", a.id, "maky")).toThrow("nothing_due");
    updateAccount(a.id, { status: "paused" });
    seedOrder({ id: "o1004", total: 5000 });
    expect(() => moveOrderToAccount("o1004", a.id, "maky")).toThrow("account_inactive");
    expect(() => moveOrderToAccount("o1004", "ha_nope", "maky")).toThrow("account_not_found");
  });
  it("removeOrderFromAccount reverses an unbilled charge and clears the order", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000 });
    moveOrderToAccount("o1001", a.id, "maky");
    const e = removeOrderFromAccount("o1001", "maky");
    expect(e).toMatchObject({ kind: "reversal", amountCents: -5000 });
    expect(order("o1001")).toMatchObject({ house_account_id: null, payment_method: null, payment_status: "pending" });
    expect(accountBalanceCents(a.id)).toBe(0);
    expect(() => removeOrderFromAccount("o1001", "maky")).toThrow("not_on_account");
  });
  it("refuses to remove once billed or once a payment landed after the charge", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, accountId: a.id });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 5000, actor: "maky" });
    recordPayment({ accountId: a.id, amountCents: 100, method: "cash", actor: "maky" });
    expect(() => removeOrderFromAccount("o1001", "maky")).toThrow("has_payments");
    seedOrder({ id: "o1002", total: 500, accountId: a.id });
    const e = recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 500, actor: "maky" });
    getDb().prepare("UPDATE house_account_entries SET statement_id = 'hst_x' WHERE id = ?").run(e.id);
    expect(() => removeOrderFromAccount("o1002", "maky")).toThrow("already_billed");
  });
});

describe("settlement", () => {
  it("one payment settles two cumulative statements at once and cancels their queue", () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id, "s1", "2026-08-31", 10000);
    seedStatement(a.id, "s2", "2026-09-30", 15000);
    const [send] = enqueue([{ accountId: a.id, statementId: "s2", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" }]);
    recordPayment({ accountId: a.id, amountCents: 6000, method: "ach", actor: "maky" });
    expect(statement("s1")).toMatchObject({ status: "open", settledCents: 6000 });
    expect(statement("s2")).toMatchObject({ status: "open", settledCents: 6000 });
    expect(dueCents(statement("s2"))).toBe(9000);
    recordPayment({ accountId: a.id, amountCents: 9000, method: "ach", actor: "maky" });
    expect(statement("s1")).toMatchObject({ status: "paid", settledCents: 10000 });
    expect(statement("s2")).toMatchObject({ status: "paid", settledCents: 15000 });
    expect(getSend(send.id)?.status).toBe("canceled");
  });
  it("a reversal that zeroes the balance marks the open statement paid", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 5000, actor: "maky" });
    seedStatement(a.id, "s1", "2026-09-30", 5000);
    getDb().prepare("UPDATE house_account_entries SET statement_id = 's1' WHERE account_id = ?").run(a.id);
    getDb().prepare("UPDATE orders SET fulfillment_status = 'canceled' WHERE id = 'o1001'").run();
    reverseOrderCharge("o1001", "maky");
    expect(statement("s1").status).toBe("paid");
  });
  it("a negative entry captured in the statement's own snapshot does not settle it", () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id, "s1", "2026-09-30", 5000);
    getDb().prepare("INSERT INTO house_account_entries (id, account_id, kind, amount_cents, actor, created_at, statement_id) VALUES ('e1', ?, 'payment', -5000, 't', '2026-09-30T12:00:00Z', 's1')").run(a.id);
    expect(recomputeSettlement(a.id)).toEqual([]);
    expect(statement("s1")).toMatchObject({ status: "open", settledCents: 0 });
  });
  it("an unbilled negative entry settles the statement even on the close date", () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id, "s1", "2026-09-30", 5000);
    getDb().prepare("INSERT INTO house_account_entries (id, account_id, kind, amount_cents, actor, created_at) VALUES ('e1', ?, 'payment', -5000, 't', '2026-09-30T12:00:00Z')").run(a.id);
    expect(recomputeSettlement(a.id)).toEqual(["s1"]);
    expect(statement("s1")).toMatchObject({ status: "paid", settledCents: 5000 });
  });
});

describe("stripe", () => {
  it("recordStripeStatementPayment is idempotent per session", () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id, "s1", "2026-09-30", 5000);
    const first = recordStripeStatementPayment({ statementId: "s1", sessionId: "cs_1", amountCents: 5000 });
    expect(first?.entry).toMatchObject({ method: "stripe", stripeSessionId: "cs_1", actor: "stripe" });
    const again = recordStripeStatementPayment({ statementId: "s1", sessionId: "cs_1", amountCents: 5000 });
    expect(again?.entry).toBeNull();
    expect(accountBalanceCents(a.id)).toBe(-5000);
    expect(statement("s1").status).toBe("paid");
    expect(recordStripeStatementPayment({ statementId: "nope", sessionId: "cs_2", amountCents: 1 })).toBeNull();
    expect(listEntries(a.id)).toHaveLength(1);
  });
});
