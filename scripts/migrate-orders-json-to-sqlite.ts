#!/usr/bin/env tsx
import { promises as fs } from "node:fs";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import type { Order } from "../types/order";

type OrderRow = {
  id: string;
  locale: string;
  source: string;
  customer_id: string | null;
  recipient_name: string;
  recipient_phone: string;
  contact_email: string | null;
  contact_phone: string;
  fulfillment_method: string;
  address_json: string | null;
  window_date: string | null;
  window_slot: string | null;
  card_message: string | null;
  lines_json: string;
  subtotal_cents: number;
  delivery_cents: number;
  tax_cents: number;
  total_cents: number;
  fulfillment_status: string;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
  taken_by: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

function orderToRow(o: Order): OrderRow {
  const f = o.fulfillment;
  return {
    id: o.id,
    locale: o.locale,
    source: o.source,
    customer_id: o.customerId ?? null,
    recipient_name: f.recipient.name,
    recipient_phone: f.recipient.phone,
    contact_email: o.contact.email ?? null,
    contact_phone: o.contact.phone,
    fulfillment_method: f.method,
    address_json: f.method === "delivery" ? JSON.stringify(f.address) : null,
    window_date: f.method === "in-store" ? null : f.window.date,
    window_slot: f.method === "in-store" ? null : f.window.slot,
    card_message: f.cardMessage ?? null,
    lines_json: JSON.stringify(o.lines),
    subtotal_cents: o.totals.subtotalCents,
    delivery_cents: o.totals.deliveryCents,
    tax_cents: o.totals.taxCents,
    total_cents: o.totals.totalCents,
    fulfillment_status: o.status,
    payment_status: o.paymentStatus,
    payment_method: o.paymentMethod ?? null,
    paid_at: o.paidAt ?? null,
    stripe_payment_intent_id: o.stripePaymentIntentId ?? null,
    taken_by: o.takenBy ?? null,
    internal_notes: o.internalNotes ?? null,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  };
}

type LegacyOrder = Omit<Order, "source" | "paymentStatus" | "updatedAt" | "fulfillment"> & {
  source?: Order["source"];
  paymentStatus?: Order["paymentStatus"];
  updatedAt?: string;
  fulfillment?: Order["fulfillment"];
  delivery?: Order["fulfillment"]; // legacy name
};

let dbInstance: DB | null = null;

function resolveFile(): string {
  const file = process.env.SQLITE_FILE ?? path.join(process.cwd(), "data", "diva.sqlite");
  if (file === ":memory:") return file;
  mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

function getDb(): DB {
  if (dbInstance) return dbInstance;
  const file = resolveFile();
  dbInstance = new Database(file);
  if (file !== ":memory:") {
    dbInstance.pragma("journal_mode = WAL");
  }
  dbInstance.pragma("foreign_keys = ON");
  dbInstance.pragma("busy_timeout = 5000");
  return dbInstance;
}

function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function runMigrations(): void {
  const db = getDb();
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    db
      .prepare("SELECT name FROM schema_migrations")
      .all()
      .map((r) => (r as { name: string }).name),
  );
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  mkdirSync(migrationsDir, { recursive: true });
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const insert = db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = readFileSync(path.join(migrationsDir, f), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      insert.run(f, new Date().toISOString());
    });
    tx();
    console.log(JSON.stringify({ event: "migration_applied", name: f }));
  }
}

function normalize(o: LegacyOrder): Order {
  const fulfillment = (o.fulfillment ?? o.delivery) as Order["fulfillment"];
  const isPaid = (o as { status?: string }).status === "paid";
  const lines = (o.lines as unknown as Array<Record<string, unknown>>).map((l) =>
    l.kind ? (l as unknown as Order["lines"][number]) : ({ kind: "catalog", ...l } as Order["lines"][number]),
  );
  return {
    id: o.id,
    source: o.source ?? "web",
    locale: o.locale,
    customerId: undefined,
    lines,
    fulfillment,
    contact: o.contact,
    totals: o.totals,
    status: isPaid ? "preparing" : ((o as { status: Order["status"] }).status ?? "pending"),
    paymentStatus: o.paymentStatus ?? (isPaid ? "paid" : "pending"),
    paidAt: isPaid ? o.createdAt : undefined,
    stripePaymentIntentId: o.stripePaymentIntentId,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt ?? o.createdAt,
  };
}

async function main() {
  const file = path.resolve(process.cwd(), "pending-orders.json");
  const raw = await fs.readFile(file, "utf8");
  const legacy = JSON.parse(raw) as LegacyOrder[];
  runMigrations();
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO orders (
       id, locale, source, customer_id, recipient_name, recipient_phone,
       contact_email, contact_phone, fulfillment_method, address_json,
       window_date, window_slot, card_message, lines_json,
       subtotal_cents, delivery_cents, tax_cents, total_cents,
       fulfillment_status, payment_status, payment_method, paid_at,
       stripe_payment_intent_id, taken_by, internal_notes, created_at, updated_at
     ) VALUES (
       @id, @locale, @source, @customer_id, @recipient_name, @recipient_phone,
       @contact_email, @contact_phone, @fulfillment_method, @address_json,
       @window_date, @window_slot, @card_message, @lines_json,
       @subtotal_cents, @delivery_cents, @tax_cents, @total_cents,
       @fulfillment_status, @payment_status, @payment_method, @paid_at,
       @stripe_payment_intent_id, @taken_by, @internal_notes, @created_at, @updated_at
     )`,
  );
  let imported = 0;
  const tx = db.transaction(() => {
    for (const lo of legacy) {
      const order = normalize(lo);
      insert.run(orderToRow(order));
      imported++;
    }
  });
  tx();

  const countOnDb = db.prepare("SELECT COUNT(*) as c FROM orders").get() as { c: number };
  console.log(JSON.stringify({ event: "migration_done", json_count: legacy.length, db_count: countOnDb.c, imported }));
  if (legacy.length !== countOnDb.c) {
    console.error("MISMATCH — investigate before promoting reads to SQLite");
    process.exitCode = 2;
  }
  closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
