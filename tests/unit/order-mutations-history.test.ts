import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { markPaidManual, changeFulfillmentStatus, cancelOrder, appendInternalNote, settleBalance } from "@/lib/order-mutations";
import { listOrderHistory } from "@/lib/order-history";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, opts: { total?: number; payment?: string } = {}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-07-01', '[]',
       ?,0,0,?, 'pending', ?, '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id, opts.total ?? 5000, opts.total ?? 5000, opts.payment ?? "pending");
}

describe("mutations write history", () => {
  it("markPaidManual logs payment and sets amount_paid_cents = total", async () => {
    seed("m1", { total: 5000 });
    await markPaidManual("m1", { method: "cash" });
    const hist = await listOrderHistory("m1");
    expect(hist.some((c) => c.kind === "payment")).toBe(true);
    const row = getDb().prepare("SELECT amount_paid_cents FROM orders WHERE id='m1'").get() as { amount_paid_cents: number };
    expect(row.amount_paid_cents).toBe(5000);
  });

  it("changeFulfillmentStatus logs fulfillment", async () => {
    seed("m2");
    await changeFulfillmentStatus("m2", "preparing");
    expect((await listOrderHistory("m2")).some((c) => c.kind === "fulfillment")).toBe(true);
  });

  it("cancelOrder logs cancel", async () => {
    seed("m3");
    await cancelOrder("m3", { refund: false, reason: "duplicada" });
    expect((await listOrderHistory("m3")).some((c) => c.kind === "cancel")).toBe(true);
  });

  it("appendInternalNote logs note", async () => {
    seed("m4");
    await appendInternalNote("m4", "ring twice", "maky");
    expect((await listOrderHistory("m4")).some((c) => c.kind === "note")).toBe(true);
  });

  it("settleBalance sets amount_paid = total and logs payment", async () => {
    seed("m5", { total: 6000, payment: "paid" });
    getDb().prepare("UPDATE orders SET amount_paid_cents = 5000 WHERE id='m5'").run();
    const o = await settleBalance("m5", "maky");
    expect(o.amountPaidCents).toBe(6000);
    expect((await listOrderHistory("m5")).some((c) => c.kind === "payment")).toBe(true);
  });
});
