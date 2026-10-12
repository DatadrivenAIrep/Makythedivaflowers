// @vitest-environment node
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

const requireAdminMock = vi.fn();
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: (...a: unknown[]) => requireAdminMock(...a) }));

import { POST } from "@/app/api/admin/orders/[id]/delivery-photo/route";
import { GET } from "@/app/api/delivery-photo/[token]/route";

let dir: string;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);

function seed(id: string, method = "delivery", status = "out-for-delivery") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at, address_json)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', ?, '2026-06-01', '[]',
       0,0,0,0, ?, 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z',
       '{"street1":"1 A","city":"X","state":"NY","zip":"11507","country":"US"}')`,
  ).run(id, method, status);
}

function upload(id: string, bytes: Buffer, type = "image/jpeg") {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], "p.jpg", { type }));
  form.set("width", "1600");
  form.set("height", "1200");
  return POST(new Request("http://x", { method: "POST", body: form }), { params: Promise.resolve({ id }) });
}
const get = (token: string) => GET(new Request("http://x"), { params: Promise.resolve({ token }) });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dpr-"));
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("DELIVERY_PHOTOS_DIR", dir);
  runMigrations();
  requireAdminMock.mockReset().mockReturnValue(true);
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); fs.rmSync(dir, { recursive: true, force: true }); });

it("401 without a session", async () => {
  requireAdminMock.mockReturnValue(false);
  seed("o1");
  expect((await upload("o1", JPEG)).status).toBe(401);
});

it("404 for an unknown order", async () => {
  expect((await upload("nope", JPEG)).status).toBe(404);
});

it("400 for a pickup order", async () => {
  seed("o1", "pickup");
  const res = await upload("o1", JPEG);
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "not_delivery" });
});

it("400 for an already delivered order", async () => {
  seed("o1", "delivery", "delivered");
  expect(await (await upload("o1", JPEG)).json()).toEqual({ error: "already_delivered" });
});

it("400 for non-JPEG bytes", async () => {
  seed("o1");
  const res = await upload("o1", Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png");
  expect(await res.json()).toEqual({ error: "not_jpeg" });
});

it("413 for oversize files", async () => {
  seed("o1");
  const res = await upload("o1", Buffer.concat([JPEG, Buffer.alloc(4_600_000)]));
  expect(res.status).toBe(413);
});

it("stores the photo and serves it by token", async () => {
  seed("o1");
  const res = await upload("o1", JPEG);
  expect(res.status).toBe(200);
  const { token, url } = (await res.json()) as { token: string; url: string };
  expect(url).toBe(`/api/delivery-photo/${token}`);
  const img = await get(token);
  expect(img.status).toBe(200);
  expect(img.headers.get("content-type")).toBe("image/jpeg");
  expect(img.headers.get("cache-control")).toBe("private, max-age=86400");
  expect(img.headers.get("x-robots-tag")).toBe("noindex");
  expect(Buffer.from(await img.arrayBuffer()).equals(JPEG)).toBe(true);
});

it("404 for unknown and malformed tokens, same body", async () => {
  const a = await get("0".repeat(32));
  const b = await get("../etc/passwd");
  expect(a.status).toBe(404);
  expect(b.status).toBe(404);
  expect(await a.text()).toBe(await b.text());
});
