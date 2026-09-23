import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { GET } from "@/app/api/admin/orders/[id]/invoice/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, order_number, created_at, updated_at)
     VALUES (?, 'en', 'walk-in', 'Ana <b>', '555', '5165551234', 'in-store', NULL, NULL, '[]', 10000,0,863,10863,
       'pending', 'pending', 1001, '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}
function authed() {
  return new Request("http://x", { headers: { cookie: `intake_session=${signSession()}` } });
}

describe("GET /api/admin/orders/[id]/invoice", () => {
  it("returns the invoice HTML", async () => {
    seed("i1");
    const res = await GET(authed(), { params: Promise.resolve({ id: "i1" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html.toLowerCase()).toContain("<!doctype html>");
    expect(html).toContain("INV-1001");
    expect(html).toContain("Balance due");
    expect(html).toContain("window.print()");
    // user text is escaped
    expect(html).toContain("Ana &lt;b&gt;");
    expect(html).not.toContain("Ana <b>");
  });

  it("401 without session", async () => {
    seed("i2");
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "i2" }) });
    expect(res.status).toBe(401);
  });

  it("404 unknown order", async () => {
    const res = await GET(authed(), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});
