import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { Address } from "@/types/address";

// Recipients have no table of their own: every order already stores who it went
// to, so their history is read straight from `orders`. Phones are stored as
// digits by the current forms, but older rows and order edits may carry
// punctuation or a leading 1 — so both sides are compared on the last 10 digits.

/** A delivery address used for a recipient, with how often and when it was last used. */
export type PastAddress = {
  address: Address;
  orderCount: number;
  lastDate: string;
};

export type KnownRecipient = {
  name: string;
  /** Last 10 digits, or "" when the orders never carried a usable phone. */
  phone: string;
  lastAddress?: Address;
  /** Every distinct delivery address, most recently used first. */
  addresses: PastAddress[];
  orderCount: number;
  /** Delivery/pickup date (YYYY-MM-DD), or the order's creation day for in-store. */
  lastDate: string;
  lastOrderId: string;
};

export type RecipientSender = {
  name: string;
  phone: string;
  customerId?: string;
  orderCount: number;
};

export type RecipientProfile = Omit<KnownRecipient, "lastOrderId"> & {
  senders: RecipientSender[];
};

type Row = {
  id: string;
  customer_id: string | null;
  recipient_name: string;
  recipient_phone: string;
  contact_name: string | null;
  contact_phone: string;
  address_json: string | null;
  day: string;
};

const SENDER_LIMIT = 25;
const ADDRESS_LIMIT = 8;

function last10(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function digitsSql(col: string): string {
  return `substr(replace(replace(replace(replace(replace(replace(${col}, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), -10)`;
}

const SELECT = `SELECT id, customer_id, recipient_name, recipient_phone, contact_name, contact_phone, address_json,
  COALESCE(window_date, substr(created_at, 1, 10)) AS day
  FROM orders`;

// A canceled order never went out, and an unpaid web order is an abandoned checkout.
const LIVE = `fulfillment_status != 'canceled' AND NOT (source = 'web' AND payment_status = 'pending')`;

const NEWEST_FIRST = `ORDER BY day DESC, created_at DESC, id DESC`;

function recipientKey(r: Row): string | null {
  const phone = last10(r.recipient_phone);
  if (phone) return phone;
  const name = r.recipient_name.trim().toLowerCase();
  return name ? `name:${name}` : null;
}

// An order whose recipient is the buyer (walk-in, self pickup) says nothing about who they send to.
function isSelf(r: Row): boolean {
  const phone = last10(r.recipient_phone);
  return phone !== "" && phone === last10(r.contact_phone);
}

function parseAddress(json: string | null): Address | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as Address;
  } catch {
    return undefined;
  }
}

// Same street + apt + ZIP is the same place, however it was capitalized or spaced.
function addressKey(a: Address): string {
  const norm = (v: string | undefined) => (v ?? "").toLowerCase().replace(/[.,#]/g, "").replace(/\s+/g, " ").trim();
  return `${norm(a.street1)}|${norm(a.street2)}|${(a.zip ?? "").slice(0, 5)}`;
}

/** Distinct delivery addresses across rows (newest first); each keeps its latest spelling. */
function pastAddresses(rows: Row[]): PastAddress[] {
  const byKey = new Map<string, PastAddress>();
  for (const r of rows) {
    const address = parseAddress(r.address_json);
    if (!address?.street1?.trim()) continue;
    const key = addressKey(address);
    const seen = byKey.get(key);
    if (seen) seen.orderCount += 1;
    else byKey.set(key, { address, orderCount: 1, lastDate: r.day });
  }
  return [...byKey.values()].slice(0, ADDRESS_LIMIT);
}

/** Rows arrive newest first, so the first row of a group is its latest order. */
function summarize(rows: Row[]): KnownRecipient {
  const latest = rows[0];
  const addresses = pastAddresses(rows);
  const lastAddress = addresses[0]?.address;
  return {
    name: latest.recipient_name.trim(),
    phone: last10(latest.recipient_phone),
    ...(lastAddress ? { lastAddress } : {}),
    addresses,
    orderCount: rows.length,
    lastDate: latest.day,
    lastOrderId: latest.id,
  };
}

/** Everyone a sender has sent flowers to, most recent first. */
export function recipientsForSender(sender: { customerId?: string; phone?: string }): KnownRecipient[] {
  const phone = last10(sender.phone);
  const where: string[] = [];
  const params: string[] = [];
  if (sender.customerId) {
    where.push("customer_id = ?");
    params.push(sender.customerId);
  }
  if (phone) {
    where.push(`${digitsSql("contact_phone")} = ?`);
    params.push(phone);
  }
  if (where.length === 0) return [];

  runMigrations();
  const rows = getDb()
    .prepare(`${SELECT} WHERE (${where.join(" OR ")}) AND ${LIVE} ${NEWEST_FIRST}`)
    .all(...params) as Row[];

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (isSelf(r)) continue;
    const key = recipientKey(r);
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  // Map keeps insertion order, and groups were created newest-first.
  return [...groups.values()].slice(0, SENDER_LIMIT).map(summarize);
}

/** What the shop knows about a phone as a recipient: who it is, where, and who sends to them. */
export function recipientProfile(phoneInput: string): RecipientProfile | null {
  const phone = last10(phoneInput);
  if (!phone) return null;

  runMigrations();
  const rows = (
    getDb()
      .prepare(`${SELECT} WHERE ${digitsSql("recipient_phone")} = ? AND ${LIVE} ${NEWEST_FIRST}`)
      .all(phone) as Row[]
  ).filter((r) => !isSelf(r));
  if (rows.length === 0) return null;

  const senders = new Map<string, RecipientSender>();
  for (const r of rows) {
    const key = last10(r.contact_phone) || `name:${(r.contact_name ?? "").trim().toLowerCase()}`;
    const s = senders.get(key);
    if (s) {
      s.orderCount += 1;
      if (!s.customerId && r.customer_id) s.customerId = r.customer_id;
      continue;
    }
    senders.set(key, {
      name: (r.contact_name ?? "").trim(),
      phone: last10(r.contact_phone),
      ...(r.customer_id ? { customerId: r.customer_id } : {}),
      orderCount: 1,
    });
  }

  const { name, lastAddress, addresses, orderCount, lastDate } = summarize(rows);
  return {
    name,
    phone,
    ...(lastAddress ? { lastAddress } : {}),
    addresses,
    orderCount,
    lastDate,
    // Stable sort: ties keep the newest-first order they were met in.
    senders: [...senders.values()].sort((a, b) => b.orderCount - a.orderCount),
  };
}
