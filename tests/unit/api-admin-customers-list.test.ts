import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addTag } from "@/lib/customer-storage";
import { GET } from "@/app/api/admin/customers/route";

const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedCustomer(id: string, name: string, phone: string) {
  const seen = new Date(Date.now() - 200 * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
  ).run(id, name, phone, seen, seen);
}

function seedOrder(id: string, customerId: string, daysAgo: number, paidCents: number) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
       contact_phone, fulfillment_method, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, amount_paid_cents, fulfillment_status, payment_status,
       created_at, updated_at)
     VALUES (?, 'es', 'walk-in', ?, 'R', '1', '1', 'pickup', '[]', 0, 0, 0, ?, ?,
       'pending', 'paid', ?, ?)`,
  ).run(id, customerId, paidCents, paidCents, at, at);
}

function seed() {
  seedCustomer("ana", "Ana", "5550001");
  seedCustomer("bob", "Bob", "5550002");
  [1, 2, 3, 4, 5].forEach((d) => seedOrder(`a${d}`, "ana", d, 12000)); // VIP
  seedOrder("b1", "bob", 100, 8000);
  seedOrder("b2", "bob", 150, 8000); // at-risk
}

it("returns customers with metrics, tags, stats, nextCursor", async () => {
  seed();
  addTag("ana", "boda");
  const res = await GET(new Request("http://x/api/admin/customers"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.customers).toHaveLength(2);
  const ana = body.customers.find((c: { id: string }) => c.id === "ana");
  expect(ana.metrics.segment).toBe("vip");
  expect(ana.metrics.ltvCents).toBe(60000);
  expect(ana.tags).toEqual(["boda"]);
  expect(body.stats.total).toBe(2);
  expect(body.nextCursor).toBeNull();
});

it("applies q, segment, sort, and limit params", async () => {
  seed();
  const filtered = await (await GET(new Request("http://x/api/admin/customers?q=ana"))).json();
  expect(filtered.customers.map((c: { id: string }) => c.id)).toEqual(["ana"]);

  const atRisk = await (await GET(new Request("http://x/api/admin/customers?segment=at_risk"))).json();
  expect(atRisk.customers.map((c: { id: string }) => c.id)).toEqual(["bob"]);

  const paged = await (await GET(new Request("http://x/api/admin/customers?sort=name&limit=1"))).json();
  expect(paged.customers.map((c: { id: string }) => c.id)).toEqual(["ana"]);
  expect(paged.nextCursor).toBeTruthy();
});

it("ignores invalid segment/sort values instead of erroring", async () => {
  seed();
  const res = await GET(new Request("http://x/api/admin/customers?segment=bogus&sort=bogus"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.customers).toHaveLength(2);
});

it("segment=lapsed returns only single-order customers past the cutoff", async () => {
  seed();
  seedCustomer("cleo", "Cleo", "5550003");
  seedOrder("c1", "cleo", 120, 9000); // one order, 120 days ago → lapsed
  seedCustomer("dan", "Dan", "5550004");
  seedOrder("d1", "dan", 5, 9000); // one order, 5 days ago → new

  const res = await GET(new Request("http://x/api/admin/customers?segment=lapsed"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.customers.map((c: { id: string }) => c.id)).toEqual(["cleo"]);
});

it("counts lapsed customers in the header stats", async () => {
  seedCustomer("cleo", "Cleo", "5550003");
  seedOrder("c1", "cleo", 120, 9000);
  seedCustomer("dan", "Dan", "5550004");
  seedOrder("d1", "dan", 5, 9000);

  const res = await GET(new Request("http://x/api/admin/customers"));
  const body = await res.json();
  expect(body.stats.lapsedCount).toBe(1);
});

it("a lapsed customer badged vip by precedence still matches the lapsed filter", async () => {
  seedCustomer("eve", "Eve", "5550005");
  seedOrder("e1", "eve", 120, 60000); // one order, 120 days, $600 → vip badge, lapsed flag
  seedCustomer("fay", "Fay", "5550006");
  [1, 2, 3, 4, 5].forEach((d) => seedOrder(`f${d}`, "fay", d, 12000)); // 5 recent orders → vip badge, NOT lapsed

  const res = await GET(new Request("http://x/api/admin/customers?segment=lapsed"));
  const body = await res.json();
  expect(body.customers.map((c: { id: string }) => c.id)).toEqual(["eve"]);
  expect(body.customers[0].metrics.segment).toBe("vip");
  expect(body.customers[0].metrics.isLapsed).toBe(true);
});
