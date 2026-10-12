import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDeliveryPhoto, saveDeliveryPhoto } from "@/lib/delivery-photos";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { PATCH } from "@/app/api/admin/orders/[id]/fulfillment/route";

let photosDir: string;
beforeEach(() => {
  photosDir = fs.mkdtempSync(path.join(os.tmpdir(), "ful-"));
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("DELIVERY_PHOTOS_DIR", photosDir);
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); fs.rmSync(photosDir, { recursive: true, force: true }); });

function seed(id: string, status = "pending") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, ?, 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, status);
}

it("advances pending → preparing", async () => {
  seed("o1");
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "preparing" }) }),
    { params: Promise.resolve({ id: "o1" }) },
  );
  expect(res.status).toBe(200);
});

it("returns 400 on backward transition", async () => {
  seed("o2", "out-for-delivery");
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "preparing" }) }),
    { params: Promise.resolve({ id: "o2" }) },
  );
  expect(res.status).toBe(400);
});

it("returns 404 for unknown order", async () => {
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "preparing" }) }),
    { params: Promise.resolve({ id: "nope" }) },
  );
  expect(res.status).toBe(404);
});

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
const patch = (id: string, payload: unknown) =>
  PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload) }),
    { params: Promise.resolve({ id }) },
  );

describe("delivered + stored photo", () => {
  it("photo:false discards the stored photo and delivers", async () => {
    seed("p1", "out-for-delivery");
    expect(saveDeliveryPhoto("p1", JPEG, { width: 1600, height: 1200 }).ok).toBe(true);
    const res = await patch("p1", { status: "delivered", photo: false });
    expect(res.status).toBe(200);
    expect(getDeliveryPhoto("p1")).toBeUndefined();
    expect(getDb().prepare(`SELECT fulfillment_status s FROM orders WHERE id='p1'`).get()).toEqual({ s: "delivered" });
  });

  it("without photo:false the stored photo is kept", async () => {
    seed("p2", "out-for-delivery");
    saveDeliveryPhoto("p2", JPEG, { width: 1600, height: 1200 });
    const res = await patch("p2", { status: "delivered" });
    expect(res.status).toBe(200);
    expect(getDeliveryPhoto("p2")).toBeDefined();
  });

  it("delivering an already-delivered order is an idempotent 200 that touches nothing", async () => {
    seed("p3", "delivered");
    saveDeliveryPhoto("p3", JPEG, { width: 1600, height: 1200 });
    const res = await patch("p3", { status: "delivered", photo: false });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { order: { status: string } }).order.status).toBe("delivered");
    expect(getDeliveryPhoto("p3")).toBeDefined();
  });

  it("unknown order with photo:false is still 404", async () => {
    expect((await patch("nope", { status: "delivered", photo: false })).status).toBe(404);
  });

  it("rejects photo:true", async () => {
    seed("p4", "out-for-delivery");
    expect((await patch("p4", { status: "delivered", photo: true })).status).toBe(400);
  });
});
