import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { POST } from "@/app/api/admin/orders/[id]/notes/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', 'pending', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id);
}

it("appends a note", async () => {
  seed("n1");
  const res = await POST(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "ring twice" }) }),
    { params: Promise.resolve({ id: "n1" }) },
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.order.internalNotes).toContain("ring twice");
});

it("rejects empty notes", async () => {
  seed("n2");
  const res = await POST(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "   " }) }),
    { params: Promise.resolve({ id: "n2" }) },
  );
  expect(res.status).toBe(400);
});
