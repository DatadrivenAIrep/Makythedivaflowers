// A statement is settled by the negative ledger entries it did not capture:
// an entry captured by this statement or by an EARLIER one is already inside
// closing_cents and never counts. Of the rest:
//  - payment, credit, and an adjustment with no order count always (money in);
//  - a reversal or an order-bound adjustment counts only when that order's
//    charge was billed on this statement or an earlier one. Cancelling or
//    removing an order nobody has been billed for yet must not reduce what an
//    older statement says is due.
// Recomputed from the ledger (never incremented) so no code path can drift.
// closing_cents is the cumulative balance, so one payment settles every older
// open statement at once.
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
    .prepare("SELECT amount_cents, statement_id, order_id, kind FROM house_account_entries WHERE account_id = ? AND amount_cents < 0")
    .all(accountId) as { amount_cents: number; statement_id: string | null; order_id: string | null; kind: string }[];
  const all = db
    .prepare("SELECT id, period_end, closing_cents, status FROM house_account_statements WHERE account_id = ? AND status != 'void'")
    .all(accountId) as { id: string; period_end: string; closing_cents: number; status: string }[];
  const periodEndOf = new Map(all.map((s) => [s.id, s.period_end]));
  // Per order: the earliest period_end among the live statements that captured one of its charges.
  const chargeRows = db
    .prepare("SELECT order_id, statement_id FROM house_account_entries WHERE account_id = ? AND kind = 'charge' AND order_id IS NOT NULL AND statement_id IS NOT NULL")
    .all(accountId) as { order_id: string; statement_id: string }[];
  const chargeBilledAt = new Map<string, string>();
  for (const c of chargeRows) {
    const pe = periodEndOf.get(c.statement_id);
    if (pe === undefined) continue;
    const prev = chargeBilledAt.get(c.order_id);
    if (prev === undefined || pe < prev) chargeBilledAt.set(c.order_id, pe);
  }
  const open = all.filter((x) => x.status === "open");
  const update = db.prepare("UPDATE house_account_statements SET settled_cents = ?, status = ? WHERE id = ?");
  const paid: string[] = [];
  for (const s of open) {
    const sum = negatives
      .filter((n) => {
        // Snapshot rule: captured by this statement or an earlier one → already inside closing_cents.
        if (n.statement_id === s.id) return false;
        if (n.statement_id !== null && (periodEndOf.get(n.statement_id) ?? "") <= s.period_end) return false;
        const orderBound = n.kind === "reversal" || (n.kind === "adjustment" && n.order_id !== null);
        if (!orderBound) return true;
        const billedAt = n.order_id ? chargeBilledAt.get(n.order_id) : undefined;
        return billedAt !== undefined && billedAt <= s.period_end;
      })
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
