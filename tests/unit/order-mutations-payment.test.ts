import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { markPaidManual } from "@/lib/order-mutations";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-mut-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, payment: "pending" | "paid" = "pending") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       1000, 0, 88, 1088, 'pending', ?, ?, ?)`,
  ).run(id, payment, "2026-05-25T08:00:00Z", "2026-05-25T08:00:00Z");
}

describe("markPaidManual", () => {
  it("marks a pending order as paid with method + note appended", async () => {
    seed("o1", "pending");
    const order = await markPaidManual("o1", { method: "zelle", note: "Maria pagó por phone" });
    expect(order.paymentStatus).toBe("paid");
    expect(order.paymentMethod).toBe("zelle");
    expect(order.paidAt).toBeTruthy();
    expect(order.internalNotes ?? "").toContain("[paid manually as zelle]");
    expect(order.internalNotes ?? "").toContain("Maria pagó por phone");
  });

  it("is idempotent — second call returns the already-paid order untouched", async () => {
    seed("o2", "pending");
    const a = await markPaidManual("o2", { method: "cash" });
    const b = await markPaidManual("o2", { method: "venmo" as never });
    expect(b.paymentMethod).toBe("cash");
    expect(b.paidAt).toBe(a.paidAt);
  });

  it("throws if order does not exist", async () => {
    await expect(markPaidManual("missing", { method: "cash" })).rejects.toThrow();
  });
});
