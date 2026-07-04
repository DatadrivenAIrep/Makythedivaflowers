import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  atRiskCutoffIso,
  metricsFromAggregate,
  RECURRING_MIN_ORDERS,
  VIP_MIN_LTV_CENTS,
  VIP_MIN_ORDERS,
  type CustomerMetrics,
} from "@/lib/customer-metrics";
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

export type CustomerSort = "last_order" | "ltv" | "orders" | "name";
export type CustomerSegmentFilter = "new" | "recurring" | "vip" | "at_risk";

export type CustomerListFilters = {
  q?: string;
  segment?: CustomerSegmentFilter;
  tag?: string;
  sort?: CustomerSort;
  cursor?: string; // opaque; currently base64url-encoded offset
  limit?: number;
};

export type CustomerListItem = Customer & { metrics: CustomerMetrics; tags: string[] };

export type CustomerListStats = {
  total: number;
  newThisMonth: number;
  repeatRatePct: number;
  atRiskCount: number;
};

export type CustomerListResult = {
  customers: CustomerListItem[];
  stats: CustomerListStats;
  nextCursor: string | null;
};

type AggRow = CustomerRow & {
  o_count: number;
  ltv_cents: number;
  paid_count: number;
  first_order_at: string | null;
  last_order_at: string | null;
};

// LEFT JOIN so customers without any linked order still appear (o_count 0).
const AGG_JOIN = `
  FROM customers c
  LEFT JOIN (
    SELECT customer_id,
           COUNT(*)                                               AS o_count,
           SUM(amount_paid_cents)                                 AS ltv_cents,
           SUM(CASE WHEN amount_paid_cents > 0 THEN 1 ELSE 0 END) AS paid_count,
           MIN(created_at)                                        AS first_order_at,
           MAX(created_at)                                        AS last_order_at
    FROM orders
    GROUP BY customer_id
  ) a ON a.customer_id = c.id`;

function encodeOffset(n: number): string {
  return Buffer.from(String(n), "utf8").toString("base64url");
}

function decodeOffset(cursor: string): number {
  const n = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function listCustomers(
  filters: CustomerListFilters,
  now: Date = new Date(),
): CustomerListResult {
  runMigrations();
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    where.push("(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)");
    params.push(like, like, like);
  }
  if (filters.tag) {
    where.push("EXISTS (SELECT 1 FROM customer_tags t WHERE t.customer_id = c.id AND t.tag = ?)");
    params.push(filters.tag);
  }
  // Segment predicates mirror the constants in customer-metrics.ts (numbers are
  // interpolated from those exports — never from user input).
  switch (filters.segment) {
    case "new":
      where.push(`COALESCE(a.o_count, 0) < ${RECURRING_MIN_ORDERS}`);
      break;
    case "recurring":
      where.push(`COALESCE(a.o_count, 0) >= ${RECURRING_MIN_ORDERS}`);
      break;
    case "vip":
      where.push(
        `(COALESCE(a.o_count, 0) >= ${VIP_MIN_ORDERS} OR COALESCE(a.ltv_cents, 0) >= ${VIP_MIN_LTV_CENTS})`,
      );
      break;
    case "at_risk":
      where.push(`(COALESCE(a.o_count, 0) >= ${RECURRING_MIN_ORDERS} AND a.last_order_at < ?)`);
      params.push(atRiskCutoffIso(now));
      break;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const ORDER_BY: Record<CustomerSort, string> = {
    last_order: "a.last_order_at IS NULL, a.last_order_at DESC, c.id DESC",
    ltv: "COALESCE(a.ltv_cents, 0) DESC, c.id DESC",
    orders: "COALESCE(a.o_count, 0) DESC, c.id DESC",
    name: "c.name COLLATE NOCASE ASC, c.id ASC",
  };
  const orderBy = ORDER_BY[filters.sort ?? "last_order"];

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = filters.cursor ? decodeOffset(filters.cursor) : 0;

  const rows = db
    .prepare(
      `SELECT c.*,
              COALESCE(a.o_count, 0)    AS o_count,
              COALESCE(a.ltv_cents, 0)  AS ltv_cents,
              COALESCE(a.paid_count, 0) AS paid_count,
              a.first_order_at, a.last_order_at
       ${AGG_JOIN}
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit + 1, offset) as AggRow[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeOffset(offset + limit) : null;

  const tagsByCustomer = new Map<string, string[]>();
  const ids = page.map((r) => r.id);
  if (ids.length) {
    const tagRows = db
      .prepare(
        `SELECT customer_id, tag FROM customer_tags
         WHERE customer_id IN (${ids.map(() => "?").join(",")})
         ORDER BY tag`,
      )
      .all(...ids) as Array<{ customer_id: string; tag: string }>;
    for (const tr of tagRows) {
      const list = tagsByCustomer.get(tr.customer_id) ?? [];
      list.push(tr.tag);
      tagsByCustomer.set(tr.customer_id, list);
    }
  }

  const customers: CustomerListItem[] = page.map((r) => ({
    ...rowToCustomer(r),
    metrics: metricsFromAggregate(
      {
        orderCount: r.o_count,
        ltvCents: r.ltv_cents,
        paidOrderCount: r.paid_count,
        firstOrderAt: r.first_order_at,
        lastOrderAt: r.last_order_at,
      },
      now,
      { firstSeenAt: r.first_seen_at, lastSeenAt: r.last_seen_at },
    ),
    tags: tagsByCustomer.get(r.id) ?? [],
  }));

  return { customers, stats: customerStats(now), nextCursor };
}

export function customerStats(now: Date = new Date()): CustomerListStats {
  runMigrations();
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number }).n;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const newThisMonth = (
    db.prepare("SELECT COUNT(*) AS n FROM customers WHERE first_seen_at >= ?").get(monthStart) as {
      n: number;
    }
  ).n;
  const row = db
    .prepare(
      `SELECT SUM(CASE WHEN o_count >= ${RECURRING_MIN_ORDERS} THEN 1 ELSE 0 END) AS repeat_n,
              SUM(CASE WHEN o_count >= ${RECURRING_MIN_ORDERS} AND last_order_at < ? THEN 1 ELSE 0 END) AS at_risk_n
       FROM (SELECT COALESCE(a.o_count, 0) AS o_count, a.last_order_at ${AGG_JOIN})`,
    )
    .get(atRiskCutoffIso(now)) as { repeat_n: number | null; at_risk_n: number | null };
  return {
    total,
    newThisMonth,
    repeatRatePct: total > 0 ? Math.round(((row.repeat_n ?? 0) / total) * 100) : 0,
    atRiskCount: row.at_risk_n ?? 0,
  };
}
