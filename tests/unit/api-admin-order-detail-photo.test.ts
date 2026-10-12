// @vitest-environment node
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveDeliveryPhoto } from "@/lib/delivery-photos";
import { GET } from "@/app/api/admin/orders/[id]/route";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dpd-"));
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("DELIVERY_PHOTOS_DIR", dir);
  runMigrations();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at, address_json)
     VALUES ('o1', 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'out-for-delivery', 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z',
       '{"street1":"1 A","city":"X","state":"NY","zip":"11507","country":"US"}')`,
  ).run();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); fs.rmSync(dir, { recursive: true, force: true }); });

const get = () => GET(new Request("http://x"), { params: Promise.resolve({ id: "o1" }) });

it("deliveryPhoto is null without a photo", async () => {
  expect((await (await get()).json()).deliveryPhoto).toBeNull();
});

it("deliveryPhoto carries the relative url and time", async () => {
  const r = saveDeliveryPhoto("o1", Buffer.from([0xff, 0xd8, 0xff, 1]), { width: 1, height: 1 });
  if (!r.ok) throw new Error("expected ok");
  const body = await (await get()).json();
  expect(body.deliveryPhoto.url).toBe(`/api/delivery-photo/${r.token}`);
  expect(body.deliveryPhoto.createdAt).toMatch(/^\d{4}-/);
});
