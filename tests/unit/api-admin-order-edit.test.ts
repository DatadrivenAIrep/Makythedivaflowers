import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { PATCH, GET } from "@/app/api/admin/orders/[id]/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-${Math.random().toString(36).slice(2)}.json`);
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function authedReq(body: unknown) {
  return new Request("http://x", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `intake_session=${signSession()}` },
    body: JSON.stringify(body),
  });
}

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, address_json, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '555', 'delivery',
       '{"street1":"1 Main","city":"Albertson","state":"NY","zip":"11507","country":"US"}',
       '2026-07-01', 'midday',
       '[{"kind":"custom","title":"Ramo","priceCents":5000,"qty":1}]', 5000,0,0,5000,
       'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}

describe("PATCH /api/admin/orders/[id]", () => {
  it("edits and returns the updated order", async () => {
    seed("p1");
    const res = await PATCH(authedReq({ contact: { phone: "999" } }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.order.contact.phone).toBe("999");
    expect(body.change).not.toBeNull();
  });

  it("401 without a session cookie", async () => {
    seed("p2");
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }),
      { params: Promise.resolve({ id: "p2" }) },
    );
    expect(res.status).toBe(401);
  });

  it("400 on invalid body", async () => {
    seed("p3");
    const res = await PATCH(authedReq({ lines: "nope" }), { params: Promise.resolve({ id: "p3" }) });
    expect(res.status).toBe(400);
  });

  it("404 on unknown order", async () => {
    const res = await PATCH(authedReq({ contact: { phone: "1" } }), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("GET returns history and balanceCents", async () => {
    seed("p4");
    await PATCH(authedReq({ contact: { phone: "777" } }), { params: Promise.resolve({ id: "p4" }) });
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "p4" }) });
    const body = await res.json();
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.history.length).toBeGreaterThanOrEqual(1);
    expect(typeof body.balanceCents).toBe("number");
  });
});
