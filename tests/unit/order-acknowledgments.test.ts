import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { acknowledgeOrder, isAcknowledged, listAcknowledgedIds } from "@/lib/order-acknowledgments";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedOrder(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents,
       fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es','web','R','555','555','delivery','[]',0,0,0,0,'pending','pending',?,?)`,
  ).run(id, "2026-05-25T10:00:00Z", "2026-05-25T10:00:00Z");
}

describe("order-acknowledgments", () => {
  it("acknowledges an order and reports it as acknowledged", () => {
    seedOrder("o1");
    acknowledgeOrder("o1", "maky");
    expect(isAcknowledged("o1")).toBe(true);
  });

  it("returns false for unacknowledged orders", () => {
    seedOrder("o2");
    expect(isAcknowledged("o2")).toBe(false);
  });

  it("is idempotent — second ack does not throw", () => {
    seedOrder("o3");
    acknowledgeOrder("o3", "maky");
    expect(() => acknowledgeOrder("o3", "maky")).not.toThrow();
    expect(isAcknowledged("o3")).toBe(true);
  });

  it("lists acknowledged ids from a candidate set", () => {
    seedOrder("o4"); seedOrder("o5"); seedOrder("o6");
    acknowledgeOrder("o4", "maky");
    acknowledgeOrder("o6", "maky");
    const acked = listAcknowledgedIds(["o4", "o5", "o6"]);
    expect(acked.sort()).toEqual(["o4", "o6"]);
  });
});
