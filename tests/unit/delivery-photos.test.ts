// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  saveDeliveryPhoto, getDeliveryPhoto, readDeliveryPhotoByToken, listDeliveryPhotoOrderIds,
  deliveryPhotoUrl, deliveryPhotoPath, mmsMediaAllowed, MAX_DELIVERY_PHOTO_BYTES,
} from "@/lib/delivery-photos";

let dir: string;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'out-for-delivery', 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dp-"));
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("DELIVERY_PHOTOS_DIR", dir);
  runMigrations();
  seed("o1");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("saveDeliveryPhoto", () => {
  it("writes the file and the row", () => {
    const r = saveDeliveryPhoto("o1", JPEG, { width: 1600, height: 1200 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.token).toMatch(/^[a-f0-9]{32}$/);
    expect(fs.existsSync(path.join(dir, `${r.token}.jpg`))).toBe(true);
    const row = getDeliveryPhoto("o1");
    expect(row).toMatchObject({ orderId: "o1", token: r.token, bytes: JPEG.length, width: 1600, height: 1200 });
    expect(row?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("replacing deletes the previous file", () => {
    const a = saveDeliveryPhoto("o1", JPEG, { width: 10, height: 10 });
    const b = saveDeliveryPhoto("o1", JPEG, { width: 20, height: 20 });
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.token).not.toBe(b.token);
    expect(fs.existsSync(path.join(dir, `${a.token}.jpg`))).toBe(false);
    expect(fs.existsSync(path.join(dir, `${b.token}.jpg`))).toBe(true);
    expect(getDeliveryPhoto("o1")?.token).toBe(b.token);
  });

  it("rejects non-JPEG bytes", () => {
    expect(saveDeliveryPhoto("o1", PNG, { width: 1, height: 1 })).toEqual({ ok: false, error: "not_jpeg" });
  });

  it("rejects files over the limit", () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_DELIVERY_PHOTO_BYTES)]);
    expect(saveDeliveryPhoto("o1", big, { width: 1, height: 1 })).toEqual({ ok: false, error: "too_large" });
  });
});

describe("readDeliveryPhotoByToken", () => {
  it("returns the bytes for a known token", () => {
    const r = saveDeliveryPhoto("o1", JPEG, { width: 1, height: 1 });
    if (!r.ok) throw new Error("expected ok");
    expect(readDeliveryPhotoByToken(r.token)?.equals(JPEG)).toBe(true);
  });
  it("returns undefined for unknown, malformed and traversal tokens", () => {
    expect(readDeliveryPhotoByToken("0".repeat(32))).toBeUndefined();
    expect(readDeliveryPhotoByToken("abc")).toBeUndefined();
    expect(readDeliveryPhotoByToken("../../data/diva.sqlite")).toBeUndefined();
    expect(readDeliveryPhotoByToken("A".repeat(32))).toBeUndefined();
  });
});

describe("listDeliveryPhotoOrderIds", () => {
  it("returns only the ids that have a photo", () => {
    seed("o2");
    saveDeliveryPhoto("o1", JPEG, { width: 1, height: 1 });
    expect([...listDeliveryPhotoOrderIds(["o1", "o2"])]).toEqual(["o1"]);
    expect(listDeliveryPhotoOrderIds([]).size).toBe(0);
  });
});

describe("urls", () => {
  const tok = "a".repeat(32);
  it("builds relative and absolute urls", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://makythedivaflowers.com/");
    expect(deliveryPhotoPath(tok)).toBe(`/api/delivery-photo/${tok}`);
    expect(deliveryPhotoUrl(tok)).toBe(`https://makythedivaflowers.com/api/delivery-photo/${tok}`);
  });
  it("mmsMediaAllowed only for public https", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://makythedivaflowers.com");
    expect(mmsMediaAllowed()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(mmsMediaAllowed()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://127.0.0.1:3000");
    expect(mmsMediaAllowed()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://example.com");
    expect(mmsMediaAllowed()).toBe(false);
  });
});
