import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { Address } from "@/types/address";
import type { MessagingChannel } from "@/types/order";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  lastAddress?: Address;
  buyerAddress?: Address;
  orderCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  messagingChannel?: MessagingChannel;
  locale?: "en" | "es";
  notes?: string;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  last_address_json: string | null;
  buyer_address_json: string | null;
  order_count: number;
  first_seen_at: string;
  last_seen_at: string;
  messaging_channel: string | null;
  locale: string | null;
  notes: string | null;
};

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

function rowToCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email ?? undefined,
    lastAddress: r.last_address_json ? (JSON.parse(r.last_address_json) as Address) : undefined,
    buyerAddress: r.buyer_address_json ? (JSON.parse(r.buyer_address_json) as Address) : undefined,
    orderCount: r.order_count,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    messagingChannel: (r.messaging_channel as MessagingChannel | null) ?? undefined,
    locale: (r.locale as "en" | "es" | null) ?? undefined,
    notes: r.notes ?? undefined,
  };
}

function newId(): string {
  return `cus_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getByPhone(phone: string): Customer | null {
  runMigrations();
  const row = getDb()
    .prepare("SELECT * FROM customers WHERE phone = ?")
    .get(normalizePhone(phone)) as CustomerRow | undefined;
  return row ? rowToCustomer(row) : null;
}

export type UpsertInput = {
  name: string;
  phone: string;
  email?: string;
  address?: Address;
  buyerAddress?: Address;
  orderAt: string;
  messagingChannel?: MessagingChannel;
  locale?: "en" | "es";
};

export function upsertOnOrder(input: UpsertInput): Customer {
  runMigrations();
  const db = getDb();
  const phone = normalizePhone(input.phone);
  const existing = db
    .prepare("SELECT * FROM customers WHERE phone = ?")
    .get(phone) as CustomerRow | undefined;
  if (existing) {
    db.prepare(
      `UPDATE customers SET
         name = ?, email = COALESCE(?, email),
         last_address_json = COALESCE(?, last_address_json),
         buyer_address_json = COALESCE(?, buyer_address_json),
         order_count = order_count + 1,
         last_seen_at = ?,
         messaging_channel = COALESCE(?, messaging_channel),
         locale = COALESCE(?, locale)
       WHERE id = ?`,
    ).run(
      input.name,
      input.email ?? null,
      input.address ? JSON.stringify(input.address) : null,
      input.buyerAddress ? JSON.stringify(input.buyerAddress) : null,
      input.orderAt,
      input.messagingChannel ?? null,
      input.locale ?? null,
      existing.id,
    );
    const updated = db
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(existing.id) as CustomerRow;
    return rowToCustomer(updated);
  }
  const id = newId();
  db.prepare(
    `INSERT INTO customers (
       id, name, phone, email, last_address_json, buyer_address_json,
       order_count, first_seen_at, last_seen_at,
       messaging_channel, locale
     ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
  ).run(
    id,
    input.name,
    phone,
    input.email ?? null,
    input.address ? JSON.stringify(input.address) : null,
    input.buyerAddress ? JSON.stringify(input.buyerAddress) : null,
    input.orderAt,
    input.orderAt,
    input.messagingChannel ?? null,
    input.locale ?? null,
  );
  const fresh = db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as CustomerRow;
  return rowToCustomer(fresh);
}

export function getCustomerById(id: string): Customer | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM customers WHERE id = ?").get(id) as
    | CustomerRow
    | undefined;
  return row ? rowToCustomer(row) : null;
}

export type CustomerPatch = {
  notes?: string;
  name?: string;
  email?: string; // "" clears the stored email
  messagingChannel?: MessagingChannel;
  locale?: "en" | "es";
};

export function updateCustomer(id: string, patch: CustomerPatch): Customer | null {
  runMigrations();
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.notes !== undefined) { sets.push("notes = ?"); params.push(patch.notes || null); }
  if (patch.name !== undefined) { sets.push("name = ?"); params.push(patch.name); }
  if (patch.email !== undefined) { sets.push("email = ?"); params.push(patch.email || null); }
  if (patch.messagingChannel !== undefined) {
    sets.push("messaging_channel = ?");
    params.push(patch.messagingChannel);
  }
  if (patch.locale !== undefined) { sets.push("locale = ?"); params.push(patch.locale); }
  if (sets.length) {
    db.prepare(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
  }
  return getCustomerById(id);
}

export const TAG_MAX_LENGTH = 24;

/** trim + collapse inner whitespace + lowercase + cap length; null when empty. */
export function normalizeTag(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, TAG_MAX_LENGTH).trim();
  return t.length ? t : null;
}

export function listTagsFor(customerId: string): string[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT tag FROM customer_tags WHERE customer_id = ? ORDER BY tag")
    .all(customerId) as Array<{ tag: string }>;
  return rows.map((r) => r.tag);
}

export function addTag(customerId: string, tag: string): string[] {
  runMigrations();
  getDb()
    .prepare("INSERT OR IGNORE INTO customer_tags (customer_id, tag) VALUES (?, ?)")
    .run(customerId, tag);
  return listTagsFor(customerId);
}

export function removeTag(customerId: string, tag: string): string[] {
  runMigrations();
  getDb()
    .prepare("DELETE FROM customer_tags WHERE customer_id = ? AND tag = ?")
    .run(customerId, tag);
  return listTagsFor(customerId);
}

export function listAllTags(): string[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT DISTINCT tag FROM customer_tags ORDER BY tag")
    .all() as Array<{ tag: string }>;
  return rows.map((r) => r.tag);
}
