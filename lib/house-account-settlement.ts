// A statement is settled by every negative ledger entry recorded after its
// period closed. Recomputed from the ledger (never incremented) so no code
// path can drift. closing_cents is the cumulative balance, so one payment
// settles every older open statement at once.
import "server-only";
import { getDb } from "@/lib/db";
import { shopDateStr } from "@/lib/tv-slots";
import { cancelForStatement } from "@/lib/house-account-sends";

export function dueCents(s: { closingCents: number; settledCents: number }): number {
  return Math.max(0, s.closingCents - s.settledCents);
}

/** Shop-local calendar day of an ISO timestamp. */
export function entryDate(createdAtIso: string): string {
  return shopDateStr(new Date(createdAtIso));
}

/**
 * Recompute settled_cents for every open statement of the account. A statement
 * whose due amount reaches 0 becomes paid and its scheduled sends are canceled.
 * Safe to call inside a caller's transaction (it only issues UPDATEs).
 */
export function recomputeSettlement(accountId: string): string[] {
  const db = getDb();
  const negatives = db
    .prepare("SELECT amount_cents, created_at FROM house_account_entries WHERE account_id = ? AND amount_cents < 0")
    .all(accountId) as { amount_cents: number; created_at: string }[];
  const open = db
    .prepare("SELECT id, period_end, closing_cents FROM house_account_statements WHERE account_id = ? AND status = 'open'")
    .all(accountId) as { id: string; period_end: string; closing_cents: number }[];
  const update = db.prepare("UPDATE house_account_statements SET settled_cents = ?, status = ? WHERE id = ?");
  const paid: string[] = [];
  for (const s of open) {
    const sum = negatives
      .filter((n) => entryDate(n.created_at) > s.period_end)
      .reduce((acc, n) => acc + -n.amount_cents, 0);
    const settled = Math.max(0, Math.min(s.closing_cents, sum));
    const isPaid = s.closing_cents - settled <= 0;
    update.run(settled, isPaid ? "paid" : "open", s.id);
    if (isPaid) {
      cancelForStatement(s.id);
      paid.push(s.id);
    }
  }
  return paid;
}
