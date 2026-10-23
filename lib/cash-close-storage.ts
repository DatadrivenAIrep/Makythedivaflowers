import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { withTransaction } from "@/lib/db-tx";
import { readPaymentsForDay } from "@/lib/payments-storage";
import { summarizeDay, expectedCash, closeDifference, type DaySummary } from "@/lib/cash-close";

export type CashClose = {
  day: string;
  openingFloatCents: number;
  cashInCents: number;
  cashRefundsCents: number;
  cashOutCents: number;
  cashOutNote?: string;
  expectedCents: number;
  countedCents: number;
  differenceCents: number;
  floatLeftCents: number;
  reviewed: string[];
  totals: DaySummary;
  note?: string;
  actor: string;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  day: string; opening_float_cents: number; cash_in_cents: number; cash_refunds_cents: number; cash_out_cents: number;
  cash_out_note: string | null; expected_cents: number; counted_cents: number; difference_cents: number;
  float_left_cents: number; reviewed_json: string; totals_json: string; note: string | null; actor: string;
  created_at: string; updated_at: string;
};

const toClose = (r: Row): CashClose => ({
  day: r.day,
  openingFloatCents: r.opening_float_cents,
  cashInCents: r.cash_in_cents,
  cashRefundsCents: r.cash_refunds_cents,
  cashOutCents: r.cash_out_cents,
  ...(r.cash_out_note ? { cashOutNote: r.cash_out_note } : {}),
  expectedCents: r.expected_cents,
  countedCents: r.counted_cents,
  differenceCents: r.difference_cents,
  floatLeftCents: r.float_left_cents,
  reviewed: JSON.parse(r.reviewed_json) as string[],
  totals: JSON.parse(r.totals_json) as DaySummary,
  ...(r.note ? { note: r.note } : {}),
  actor: r.actor,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// The public readers and putClose run migrations first (a fresh process may hit
// the close screen before anything else); never call them inside a transaction.
function readClose(day: string): CashClose | null {
  const r = getDb().prepare("SELECT * FROM cash_closes WHERE day = ?").get(day) as Row | undefined;
  return r ? toClose(r) : null;
}

export function getClose(day: string): CashClose | null {
  runMigrations();
  return readClose(day);
}

/** The float left in the drawer by the latest close before `day` (0 if none). */
export function previousFloatCents(day: string): number {
  runMigrations();
  const r = getDb()
    .prepare("SELECT float_left_cents AS f FROM cash_closes WHERE day < ? ORDER BY day DESC LIMIT 1")
    .get(day) as { f: number } | undefined;
  return r?.f ?? 0;
}

export function listCloses(limit = 30): CashClose[] {
  runMigrations();
  return (getDb().prepare("SELECT * FROM cash_closes ORDER BY day DESC LIMIT ?").all(limit) as Row[]).map(toClose);
}

export type PutCloseInput = {
  day: string;
  openingFloatCents: number;
  cashOutCents: number;
  cashOutNote?: string;
  countedCents: number;
  floatLeftCents: number;
  reviewed: string[];
  note?: string;
  actor: string;
};

/** Save the day's close. Totals, expected cash and difference are recomputed here from the payments log. */
export function putClose(i: PutCloseInput): CashClose {
  runMigrations();
  return withTransaction(() => {
    const totals = summarizeDay(readPaymentsForDay(i.day));
    const expected = expectedCash({
      openingFloatCents: i.openingFloatCents,
      cashInCents: totals.cashInCents,
      cashRefundsCents: totals.cashRefundsCents,
      cashOutCents: i.cashOutCents,
    });
    const now = new Date().toISOString();
    getDb().prepare(
      `INSERT INTO cash_closes (day, opening_float_cents, cash_in_cents, cash_refunds_cents, cash_out_cents, cash_out_note,
         expected_cents, counted_cents, difference_cents, float_left_cents, reviewed_json, totals_json, note, actor, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET
         opening_float_cents = excluded.opening_float_cents,
         cash_in_cents = excluded.cash_in_cents,
         cash_refunds_cents = excluded.cash_refunds_cents,
         cash_out_cents = excluded.cash_out_cents,
         cash_out_note = excluded.cash_out_note,
         expected_cents = excluded.expected_cents,
         counted_cents = excluded.counted_cents,
         difference_cents = excluded.difference_cents,
         float_left_cents = excluded.float_left_cents,
         reviewed_json = excluded.reviewed_json,
         totals_json = excluded.totals_json,
         note = excluded.note,
         actor = excluded.actor,
         updated_at = excluded.updated_at`,
    ).run(
      i.day, i.openingFloatCents, totals.cashInCents, totals.cashRefundsCents, i.cashOutCents, i.cashOutNote ?? null,
      expected, i.countedCents, closeDifference(i.countedCents, expected), i.floatLeftCents,
      JSON.stringify(i.reviewed), JSON.stringify(totals), i.note ?? null, i.actor, now, now,
    );
    return readClose(i.day)!;
  });
}
