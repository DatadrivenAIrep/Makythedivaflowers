import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, accountBalanceCents } from "@/lib/house-account-storage";
import { recordCharge, listEntries } from "@/lib/house-account-ledger";
import { cancelOrder, markPaidManual, recordDeposit, settleBalance } from "@/lib/order-mutations";
import { editOrder } from "@/lib/order-edit";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-acct-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, accountId: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '5165550100', 'in-store', NULL,
       '[{"kind":"custom","title":"Ramo","priceCents":5000,"qty":1}]', 5000, 0, 0, 5000, 0, 'pending',
       'pending', 'house-account', ?, '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z')`,
  ).run(id, accountId);
}

describe("account orders", () => {
  it("cancelOrder reverses the charge once", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o1", a.id);
    recordCharge({ accountId: a.id, orderId: "o1", amountCents: 5000, actor: "m" });
    const o = await cancelOrder("o1", { refund: false, reason: "cliente" });
    expect(o.status).toBe("canceled");
    expect(listEntries(a.id).map((e) => [e.kind, e.amountCents])).toEqual([["charge", 5000], ["reversal", -5000]]);
    expect(accountBalanceCents(a.id)).toBe(0);
    await cancelOrder("o1", { refund: false });
    expect(listEntries(a.id)).toHaveLength(2);
  });
  it("cancel with refund is refused for an account order, before any write", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o3", a.id);
    recordCharge({ accountId: a.id, orderId: "o3", amountCents: 5000, actor: "m" });
    await expect(cancelOrder("o3", { refund: true })).rejects.toThrow("on_account");
    const row = getDb().prepare("SELECT fulfillment_status, payment_status FROM orders WHERE id = 'o3'").get() as { fulfillment_status: string; payment_status: string };
    expect(row).toEqual({ fulfillment_status: "pending", payment_status: "pending" });
    expect(listEntries(a.id)).toHaveLength(1);
  });
  it("order-level payment mutations are refused for an account order", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o4", a.id);
    await expect(markPaidManual("o4", { method: "cash" })).rejects.toThrow("on_account");
    await expect(recordDeposit("o4", { amountCents: 100, method: "cash" }, "maky")).rejects.toThrow("on_account");
    await expect(settleBalance("o4", "maky")).rejects.toThrow("on_account");
    const row = getDb().prepare("SELECT amount_paid_cents, payment_status FROM orders WHERE id = 'o4'").get();
    expect(row).toEqual({ amount_paid_cents: 0, payment_status: "pending" });
  });
  it("editOrder with a new total records a signed adjustment", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o2", a.id);
    recordCharge({ accountId: a.id, orderId: "o2", amountCents: 5000, actor: "m" });
    // Edit the lines (not a totalsOverride): applyPatch recomputes totals from lines on every edit, so an override would not survive the next edit.
    const { order } = await editOrder("o2", { lines: [{ kind: "custom", title: "Ramo", priceCents: 9000, qty: 1 }] }, "maky");
    const delta = order.totals.totalCents - 5000;
    expect(delta).not.toBe(0);
    const adj = listEntries(a.id).find((e) => e.kind === "adjustment")!;
    expect(adj).toMatchObject({ orderId: "o2", amountCents: delta });
    expect(accountBalanceCents(a.id)).toBe(order.totals.totalCents);
    // No change in total → no new entry.
    await editOrder("o2", { contact: { name: "Ana María" } }, "maky");
    expect(listEntries(a.id)).toHaveLength(2);
  });
});
