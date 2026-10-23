import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addressKey } from "@/lib/address-key";
import type { Address } from "@/types/address";

export type FuneralHome = {
  id: string;
  name: string;
  /** Digits only, when the shop saved one. */
  phone?: string;
  address: Address;
};

/** A delivery address from past funeral orders that has no saved funeral home yet. */
export type FuneralAddress = { address: Address; orderCount: number; lastDate: string };

const RECENT_LIMIT = 6;

type Row = { id: string; name: string; phone: string | null; address_json: string };

function newId(): string {
  return `fh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listFuneralHomes(): FuneralHome[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT id, name, phone, address_json FROM funeral_homes ORDER BY name COLLATE NOCASE")
    .all() as Row[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.phone ? { phone: r.phone } : {}),
    address: JSON.parse(r.address_json) as Address,
  }));
}

export function addFuneralHome(input: { name: string; phone?: string; address: Address }): FuneralHome {
  runMigrations();
  const phone = (input.phone ?? "").replace(/\D/g, "").slice(-10);
  const home: FuneralHome = {
    id: newId(),
    name: input.name.trim(),
    ...(phone.length === 10 ? { phone } : {}),
    address: input.address,
  };
  getDb()
    .prepare("INSERT INTO funeral_homes (id, name, phone, address_json, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(home.id, home.name, home.phone ?? null, JSON.stringify(home.address), new Date().toISOString());
  return home;
}

export function removeFuneralHome(id: string): void {
  runMigrations();
  getDb().prepare("DELETE FROM funeral_homes WHERE id = ?").run(id);
}

/** Where past funeral orders went, most used first, minus places already saved. */
export function recentFuneralAddresses(): FuneralAddress[] {
  runMigrations();
  const saved = new Set(listFuneralHomes().map((h) => addressKey(h.address)));
  const rows = getDb()
    .prepare(
      `SELECT address_json, COALESCE(window_date, substr(created_at, 1, 10)) AS day
         FROM orders
        WHERE funeral = 1 AND fulfillment_method = 'delivery' AND address_json IS NOT NULL
          AND fulfillment_status != 'canceled'
        ORDER BY day DESC`,
    )
    .all() as Array<{ address_json: string; day: string }>;
  const byKey = new Map<string, FuneralAddress>();
  for (const r of rows) {
    let address: Address;
    try {
      address = JSON.parse(r.address_json) as Address;
    } catch {
      continue;
    }
    if (!address.street1?.trim()) continue;
    const key = addressKey(address);
    if (saved.has(key)) continue;
    const seen = byKey.get(key);
    if (seen) seen.orderCount += 1;
    else byKey.set(key, { address, orderCount: 1, lastDate: r.day });
  }
  return [...byKey.values()].sort((a, b) => b.orderCount - a.orderCount).slice(0, RECENT_LIMIT);
}
