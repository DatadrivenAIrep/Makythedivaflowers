// @vitest-environment node
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addImportantDate } from "@/lib/customer-dates-storage";
import { setDatePreferences } from "@/lib/date-preferences-storage";
import { GET } from "@/app/api/admin/orders/[id]/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("DATE_REWARDS_ENABLED", "1");
  runMigrations();
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES ('c1', 'Ana', '5551', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, customer_id,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at, address_json)
     VALUES ('o1', 'es', 'walk-in', 'María', '555', '555', 'c1', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z',
       '{"street1":"1 A","city":"X","state":"NY","zip":"11507","country":"US"}')`,
  ).run();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const get = async () =>
  (await (await GET(new Request("http://x"), { params: Promise.resolve({ id: "o1" }) })).json());

it("el pedido trae lo que hay que evitar", async () => {
  const d = addImportantDate("c1", { kind: "birthday", label: "María", month: 3, day: 15 })[0];
  setDatePreferences(d.id, { flowers: [], colors: [], avoid: ["strong_scent"] });
  expect((await get()).recipientAvoid).toEqual(["strong_scent"]);
});

it("vacío sin fechas o con la variable apagada", async () => {
  expect((await get()).recipientAvoid).toEqual([]);
  const d = addImportantDate("c1", { kind: "birthday", label: "María", month: 3, day: 15 })[0];
  setDatePreferences(d.id, { flowers: [], colors: [], avoid: ["strong_scent"] });
  vi.stubEnv("DATE_REWARDS_ENABLED", "");
  expect((await get()).recipientAvoid).toEqual([]);
});
