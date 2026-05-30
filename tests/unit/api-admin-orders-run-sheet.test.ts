import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/orders/run-sheet/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, opts: {
  method?: string; windowDate?: string; slot?: string; status?: string;
} = {}) {
  const { method = "delivery", windowDate = "2026-06-01", slot = "morning", status = "pending" } = opts;
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'web', 'R', '555', '555', ?, ?, ?, '[]', 0,0,0,0, ?, 'paid',
       '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, method, windowDate, slot, status);
}

function call(date?: string) {
  const url = date ? `http://x?date=${date}` : "http://x";
  return GET(new Request(url));
}

it("returns deliveries for the given date", async () => {
  seed("d1", { windowDate: "2026-06-01" });
  seed("d2", { windowDate: "2026-06-02" });
  const res = await call("2026-06-01");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.orders).toHaveLength(1);
  expect(body.orders[0].id).toBe("d1");
});

it("excludes pickup and in-store orders", async () => {
  seed("d1", { method: "delivery" });
  seed("p1", { method: "pickup" });
  const res = await call("2026-06-01");
  const body = await res.json();
  expect(body.orders).toHaveLength(1);
  expect(body.orders[0].id).toBe("d1");
});

it("excludes canceled deliveries", async () => {
  seed("d1", { status: "canceled" });
  seed("d2", { status: "preparing" });
  const res = await call("2026-06-01");
  const body = await res.json();
  expect(body.orders.map((o: { id: string }) => o.id)).toEqual(["d2"]);
});

it("rejects a malformed date", async () => {
  const res = await call("06-01-2026");
  expect(res.status).toBe(400);
});
