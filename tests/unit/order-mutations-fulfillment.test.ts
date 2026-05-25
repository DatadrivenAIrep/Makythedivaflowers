import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { changeFulfillmentStatus } from "@/lib/order-mutations";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, status: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, ?, 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, status);
}

describe("changeFulfillmentStatus", () => {
  it("advances pending → preparing", async () => {
    seed("o1", "pending");
    const r = await changeFulfillmentStatus("o1", "preparing");
    expect(r.status).toBe("preparing");
  });

  it("allows skipping forward pending → out-for-delivery", async () => {
    seed("o2", "pending");
    const r = await changeFulfillmentStatus("o2", "out-for-delivery");
    expect(r.status).toBe("out-for-delivery");
  });

  it("rejects backward transitions", async () => {
    seed("o3", "out-for-delivery");
    await expect(changeFulfillmentStatus("o3", "preparing")).rejects.toThrow(/invalid transition/);
  });

  it("is no-op when status is unchanged", async () => {
    seed("o4", "preparing");
    const r = await changeFulfillmentStatus("o4", "preparing");
    expect(r.status).toBe("preparing");
  });

  it("rejects unsupported statuses (failed, canceled) from this endpoint", async () => {
    seed("o5", "pending");
    await expect(changeFulfillmentStatus("o5", "canceled")).rejects.toThrow();
  });
});
