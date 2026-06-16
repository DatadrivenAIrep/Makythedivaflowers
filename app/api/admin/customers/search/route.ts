import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { Address } from "@/types/address";

export const runtime = "nodejs";

type Row = { name: string; last_address_json: string };

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("address")?.trim() ?? "";
  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  runMigrations();
  // Search customers who have a saved address containing the query string.
  // We match against the stored JSON — a bit broad but fast for small datasets.
  const rows = getDb()
    .prepare(
      "SELECT name, last_address_json FROM customers WHERE last_address_json IS NOT NULL AND last_address_json LIKE ? LIMIT 5",
    )
    .all(`%${query}%`) as Row[];

  const results = rows.map((r) => ({
    name: r.name,
    address: JSON.parse(r.last_address_json) as Address,
  }));

  return NextResponse.json({ results });
}
