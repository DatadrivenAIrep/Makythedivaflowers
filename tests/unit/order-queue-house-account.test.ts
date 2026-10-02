import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getPendingQueue } from "@/lib/order-queue";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, method: string | null, session: string | null = "cs_x") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, fulfillment_status, payment_status, payment_method,
       stripe_checkout_session_id, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'R', '555', '555', 'delivery', '2026-05-25', '[]', 0, 0, 0, 5000, 'pending', 'pending', ?, ?,
       '2026-05-25T10:00:00Z', '2026-05-25T10:00:00Z')`,
  ).run(id, method, session);
}

it("house-account orders are never flagged as unpaid", async () => {
  seed("acct", "house-account");
  seed("plain", null);
  const q = await getPendingQueue();
  expect(q.find((i) => i.orderId === "plain")?.reason).toBe("delivery_today_unpaid");
  const acct = q.find((i) => i.orderId === "acct");
  // Still visible for dispatch today, but never for payment.
  expect(acct?.reason).toBe("delivery_today_undispatched");
});
