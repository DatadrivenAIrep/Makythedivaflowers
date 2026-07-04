import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addTag } from "@/lib/customer-storage";
import { GET, PATCH } from "@/app/api/admin/customers/[id]/route";

const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed() {
  const seen = new Date(Date.now() - 60 * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, email, order_count, first_seen_at, last_seen_at, notes)
     VALUES ('c1', 'Ana', '5551', 'ana@x.com', 2, ?, ?, 'sin lilies')`,
  ).run(seen, seen);
  for (const [id, daysAgo, cents] of [["o1", 30, 6000], ["o2", 5, 9000]] as const) {
    const at = new Date(Date.now() - daysAgo * DAY).toISOString();
    getDb().prepare(
      `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
         contact_phone, fulfillment_method, lines_json, subtotal_cents, delivery_cents,
         tax_cents, total_cents, amount_paid_cents, fulfillment_status, payment_status,
         created_at, updated_at)
       VALUES (?, 'es', 'walk-in', 'c1', 'R', '1', '1', 'pickup', '[]', 0, 0, 0, ?, ?,
         'delivered', 'paid', ?, ?)`,
    ).run(id, cents, cents, at, at);
  }
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/admin/customers/[id]", () => {
  it("returns customer (with notes), metrics, tags, and order history newest-first", async () => {
    seed();
    addTag("c1", "boda");
    const res = await GET(new Request("http://x"), ctx("c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customer.name).toBe("Ana");
    expect(body.customer.notes).toBe("sin lilies");
    expect(body.metrics.segment).toBe("recurring");
    expect(body.metrics.ltvCents).toBe(15000);
    expect(body.tags).toEqual(["boda"]);
    expect(body.orders.map((o: { id: string }) => o.id)).toEqual(["o2", "o1"]);
  });

  it("404s on unknown id", async () => {
    const res = await GET(new Request("http://x"), ctx("nope"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/customers/[id]", () => {
  it("updates notes and contact fields", async () => {
    seed();
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ notes: "tulipanes", name: "Ana María", email: "" }),
      }),
      ctx("c1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customer.notes).toBe("tulipanes");
    expect(body.customer.name).toBe("Ana María");
    expect(body.customer.email).toBeUndefined();
  });

  it("400s on invalid body and on empty patch", async () => {
    seed();
    const bad = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ notes: 123 }) }),
      ctx("c1"),
    );
    expect(bad.status).toBe(400);
    const empty = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({}) }),
      ctx("c1"),
    );
    expect(empty.status).toBe(400);
  });

  it("404s on unknown id", async () => {
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ notes: "x" }) }),
      ctx("nope"),
    );
    expect(res.status).toBe(404);
  });
});
