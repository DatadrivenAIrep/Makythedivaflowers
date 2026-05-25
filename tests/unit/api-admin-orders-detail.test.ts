import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/orders/[id]/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
       contact_phone, fulfillment_method, window_date, lines_json, subtotal_cents,
       delivery_cents, tax_cents, total_cents, fulfillment_status, payment_status,
       created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'c1', 'Maria', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id);
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, first_seen_at, last_seen_at)
     VALUES ('c1', 'Maria', '555', '2026-01-01', '2026-05-25')`,
  ).run();
}

it("returns order + customer + messages array", async () => {
  seed("d1");
  const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "d1" }) });
  const body = await res.json();
  expect(body.order.id).toBe("d1");
  expect(body.customer?.name).toBe("Maria");
  expect(Array.isArray(body.messages)).toBe(true);
});

it("returns 404 for unknown id", async () => {
  const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "nope" }) });
  expect(res.status).toBe(404);
});
