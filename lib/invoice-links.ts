// lib/invoice-links.ts
// The public, unguessable link a customer opens to see their invoice
// (/i/<code>). Same code space as statements and digital cards.
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { generateCode } from "@/lib/short-code";

/** The order's invoice code, allocating one on first use. Stable afterwards, so
 *  every SMS/email for an order carries the same link. */
export function ensureInvoiceCode(orderId: string): string {
  runMigrations();
  const db = getDb();
  const find = db.prepare("SELECT code FROM invoice_links WHERE order_id = ?");
  // OR IGNORE covers both races: another request already linked this order
  // (the re-read returns its code) or the random code collided (retry).
  const insert = db.prepare("INSERT OR IGNORE INTO invoice_links (order_id, code, created_at) VALUES (?, ?, ?)");
  for (let i = 0; i < 5; i++) {
    const row = find.get(orderId) as { code: string } | undefined;
    if (row) return row.code;
    insert.run(orderId, generateCode(), new Date().toISOString());
  }
  const row = find.get(orderId) as { code: string } | undefined;
  if (row) return row.code;
  throw new Error("could not allocate a unique invoice code");
}

export function getOrderIdByInvoiceCode(code: string): string | null {
  runMigrations();
  const row = getDb().prepare("SELECT order_id FROM invoice_links WHERE code = ?").get(code) as { order_id: string } | undefined;
  return row?.order_id ?? null;
}

export function siteBaseUrl(): string {
  // `||` (not `??`) so an empty env var still falls back to the shop domain.
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://makythedivaflowers.com").replace(/\/+$/, "");
}

export function invoiceUrl(code: string): string {
  return `${siteBaseUrl()}/i/${code}`;
}
