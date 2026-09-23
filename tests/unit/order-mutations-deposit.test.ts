import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { recordDeposit } from "@/lib/order-mutations";
import { listOrderHistory } from "@/lib/order-history";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-dep-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, payment: "pending" | "paid" = "pending", status = "pending") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       10000, 0, 0, 10000, ?, ?, ?, ?)`,
  ).run(id, status, payment, "2026-05-25T08:00:00Z", "2026-05-25T08:00:00Z");
}

describe("recordDeposit", () => {
  it("adds a partial payment and keeps the order pending", async () => {
    seed("d1");
    const o = await recordDeposit("d1", { amountCents: 3000, method: "zelle" }, "maky");
    expect(o.paymentStatus).toBe("pending");
    expect(o.amountPaidCents).toBe(3000);
    expect(o.paymentMethod).toBe("zelle");
    expect(o.internalNotes ?? "").toContain("[deposit $30.00 via zelle]");
    const history = await listOrderHistory("d1");
    expect(history.some((h) => h.kind === "payment" && h.summary.includes("Depósito $30.00"))).toBe(true);
  });

  it("accumulates several deposits", async () => {
    seed("d2");
    await recordDeposit("d2", { amountCents: 2000, method: "cash" }, "maky");
    const o = await recordDeposit("d2", { amountCents: 2500, method: "zelle" }, "maky");
    expect(o.amountPaidCents).toBe(4500);
    expect(o.paymentStatus).toBe("pending");
  });

  it("marks the order paid when the deposit covers the remaining balance", async () => {
    seed("d3");
    await recordDeposit("d3", { amountCents: 4000, method: "cash" }, "maky");
    const o = await recordDeposit("d3", { amountCents: 6000, method: "zelle" }, "maky");
    expect(o.paymentStatus).toBe("paid");
    expect(o.amountPaidCents).toBe(10000);
    expect(o.paidAt).toBeTruthy();
  });

  it("rejects a deposit larger than the balance", async () => {
    seed("d4");
    await expect(recordDeposit("d4", { amountCents: 10001, method: "cash" }, "maky")).rejects.toThrow(/exceeds/);
  });

  it("rejects non-positive amounts", async () => {
    seed("d5");
    await expect(recordDeposit("d5", { amountCents: 0, method: "cash" }, "maky")).rejects.toThrow();
  });

  it("rejects deposits on paid or canceled orders", async () => {
    seed("d6", "paid");
    await expect(recordDeposit("d6", { amountCents: 100, method: "cash" }, "maky")).rejects.toThrow(/not_pending/);
    seed("d7", "pending", "canceled");
    await expect(recordDeposit("d7", { amountCents: 100, method: "cash" }, "maky")).rejects.toThrow(/not_pending/);
  });

  it("throws if order does not exist", async () => {
    await expect(recordDeposit("missing", { amountCents: 100, method: "cash" }, "maky")).rejects.toThrow(/not found/);
  });
});
