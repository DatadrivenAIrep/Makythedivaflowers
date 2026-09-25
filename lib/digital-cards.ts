import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { generateCardCode, shortUrl } from "@/lib/digital-card-code";
import type { DigitalCardView } from "@/types/digital-card";

export type DigitalCard = {
  orderId: string;
  code: string;
  targetUrl: string | null;
  shortUrl: string;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  order_id: string; code: string; target_url: string | null;
  created_at: string; updated_at: string;
};

const MAX_CODE_ATTEMPTS = 5;

function toCard(r: Row): DigitalCard {
  return {
    orderId: r.order_id,
    code: r.code,
    targetUrl: r.target_url,
    shortUrl: shortUrl(r.code),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getByOrder(orderId: string): DigitalCard | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM digital_cards WHERE order_id = ?").get(orderId) as Row | undefined;
  return row ? toCard(row) : null;
}

export function getByCode(code: string): DigitalCard | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM digital_cards WHERE code = ?").get(code) as Row | undefined;
  return row ? toCard(row) : null;
}

// Idempotent: an order keeps its first code forever, so a printed QR never
// goes stale. Returns null when the order does not exist.
export function enableForOrder(orderId: string, gen: () => string = generateCardCode): DigitalCard | null {
  const existing = getByOrder(orderId);
  if (existing) return existing;
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM orders WHERE id = ?").get(orderId)) return null;
  const insert = db.prepare(
    "INSERT OR IGNORE INTO digital_cards (order_id, code, target_url, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)",
  );
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = gen();
    const now = new Date().toISOString();
    const result = insert.run(orderId, code, now, now);
    if (result.changes === 0) {
      // Either our order_id already has a row (another process won the
      // check-then-insert race) or this code was already taken by someone
      // else's order. Distinguish by re-selecting on order_id: if a row now
      // exists for this order, that is the winner, whoever inserted it.
      const winner = getByOrder(orderId);
      if (winner) return winner;
      continue;
    }
    return getByOrder(orderId);
  }
  throw new Error(`could not allocate a unique digital card code for order ${orderId}`);
}

export function setTargetUrl(orderId: string, url: string | null): DigitalCard | null {
  runMigrations();
  const res = getDb()
    .prepare("UPDATE digital_cards SET target_url = ?, updated_at = ? WHERE order_id = ?")
    .run(url, new Date().toISOString(), orderId);
  return res.changes === 0 ? null : getByOrder(orderId);
}

export function digitalCardView(card: DigitalCard): DigitalCardView {
  return { code: card.code, shortUrl: card.shortUrl, targetUrl: card.targetUrl };
}
