import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { POST } from "@/app/api/admin/orders/[id]/reprint/route";
import { listOrderHistory } from "@/lib/order-history";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("PRINT_QUEUE_FILE", `/tmp/pq-${Math.random().toString(36).slice(2)}.json`);
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
       'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}
function authed() {
  return new Request("http://x", { method: "POST", headers: { cookie: `intake_session=${signSession()}` } });
}

describe("POST /api/admin/orders/[id]/reprint", () => {
  it("enqueues a job and logs reprint", async () => {
    seed("r1");
    const res = await POST(authed(), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
    expect((await listOrderHistory("r1")).some((c) => c.kind === "reprint")).toBe(true);
  });

  it("401 without session", async () => {
    seed("r2");
    const res = await POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: "r2" }) });
    expect(res.status).toBe(401);
  });

  it("404 unknown order", async () => {
    const res = await POST(authed(), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});
