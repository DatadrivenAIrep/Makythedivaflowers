import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

/** Twilio's MMS media limit is 5 MB; stay under it with headroom. */
export const MAX_DELIVERY_PHOTO_BYTES = 4_500_000;
const TOKEN_RE = /^[a-f0-9]{32}$/;

export type DeliveryPhoto = {
  orderId: string; token: string; bytes: number; width: number; height: number; createdAt: string;
};
export type SaveResult = { ok: true; token: string } | { ok: false; error: "not_jpeg" | "too_large" };

type Row = { order_id: string; token: string; bytes: number; width: number; height: number; created_at: string };

function photosDir(): string {
  return process.env.DELIVERY_PHOTOS_DIR ?? path.join(process.cwd(), "data", "delivery-photos");
}

function fileFor(token: string): string {
  return path.join(photosDir(), `${token}.jpg`);
}

function toPhoto(r: Row): DeliveryPhoto {
  return { orderId: r.order_id, token: r.token, bytes: r.bytes, width: r.width, height: r.height, createdAt: r.created_at };
}

function isJpeg(data: Buffer): boolean {
  return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
}

/** Store (or replace) the order's proof-of-delivery photo. Callers validate the order. */
export function saveDeliveryPhoto(
  orderId: string,
  data: Buffer,
  dims: { width: number; height: number },
): SaveResult {
  if (!isJpeg(data)) return { ok: false, error: "not_jpeg" };
  if (data.length > MAX_DELIVERY_PHOTO_BYTES) return { ok: false, error: "too_large" };
  runMigrations();
  const previous = getDeliveryPhoto(orderId);
  const token = randomBytes(16).toString("hex");
  fs.mkdirSync(photosDir(), { recursive: true });
  // Write-then-rename so a half-written file is never served.
  const tmp = `${fileFor(token)}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, fileFor(token));
  getDb()
    .prepare(
      `INSERT INTO delivery_photos (order_id, token, bytes, width, height, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(order_id) DO UPDATE SET token = excluded.token, bytes = excluded.bytes,
         width = excluded.width, height = excluded.height, created_at = excluded.created_at`,
    )
    .run(orderId, token, data.length, Math.round(dims.width), Math.round(dims.height), new Date().toISOString());
  if (previous) {
    try { fs.unlinkSync(fileFor(previous.token)); } catch { /* already gone */ }
  }
  return { ok: true, token };
}

export function getDeliveryPhoto(orderId: string): DeliveryPhoto | undefined {
  runMigrations();
  const row = getDb().prepare(`SELECT * FROM delivery_photos WHERE order_id = ?`).get(orderId) as Row | undefined;
  return row ? toPhoto(row) : undefined;
}

/** Drop the order's photo (row + file). True if there was one. Safe to call repeatedly. */
export function deleteDeliveryPhoto(orderId: string): boolean {
  const existing = getDeliveryPhoto(orderId);
  if (!existing) return false;
  getDb().prepare(`DELETE FROM delivery_photos WHERE order_id = ?`).run(orderId);
  try { fs.unlinkSync(fileFor(existing.token)); } catch { /* already gone */ }
  return true;
}

export function listDeliveryPhotoOrderIds(orderIds: string[]): Set<string> {
  if (orderIds.length === 0) return new Set();
  runMigrations();
  const marks = orderIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT order_id FROM delivery_photos WHERE order_id IN (${marks})`)
    .all(...orderIds) as { order_id: string }[];
  return new Set(rows.map((r) => r.order_id));
}

/** Bytes for a public token, or undefined. Rejects malformed tokens before any fs access. */
export function readDeliveryPhotoByToken(token: string): Buffer | undefined {
  if (!TOKEN_RE.test(token)) return undefined;
  runMigrations();
  const row = getDb().prepare(`SELECT token FROM delivery_photos WHERE token = ?`).get(token);
  if (!row) return undefined;
  try { return fs.readFileSync(fileFor(token)); } catch { return undefined; }
}

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://makythedivaflowers.com").replace(/\/+$/, "");
}

export function deliveryPhotoPath(token: string): string {
  return `/api/delivery-photo/${token}`;
}

export function deliveryPhotoUrl(token: string): string {
  return `${siteBase()}${deliveryPhotoPath(token)}`;
}

/** Twilio must be able to fetch the media: only a public https origin qualifies. */
export function mmsMediaAllowed(): boolean {
  const base = siteBase();
  if (!base.startsWith("https://")) return false;
  try {
    const host = new URL(base).hostname;
    return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".localhost");
  } catch {
    return false;
  }
}
