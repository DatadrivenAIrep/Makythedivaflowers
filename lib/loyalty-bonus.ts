import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { e164 } from "@/lib/twilio-server";
import { dateRewardsEnabled } from "@/lib/date-rewards-flags";
import { loyaltyEnabled, LoyaltyApiError, lookupCustomer, addBonus } from "@/lib/loyalty-client";

/**
 * Stamps for sharing data: at most one per slot ("fecha", "gustos") per person, ever.
 *
 * Same design as loyalty-sync: the slot is queued in `loyalty_bonus` before anything
 * is attempted, the cron retries it, and after 72 hours it is left as 'failed'.
 * The order id is built from the loyalty card's id, so two Diva records that share
 * one card send the same id and the program counts it once.
 *
 * Nothing exported here throws: callers fire `void runBonus(...)`.
 */

export type BonusSlot = "fecha" | "gustos";

const CALL_TIMEOUT_MS = 10_000;
const GIVE_UP_AFTER_MS = 72 * 3600_000;
const NOTES: Record<BonusSlot, string> = {
  fecha: "Diva: fecha guardada",
  gustos: "Diva: gustos guardados",
};

type BonusRow = { customer_id: string; slot: BonusSlot; status: string; attempts: number; created_at: string };

function db() {
  runMigrations();
  return getDb();
}

/** Only the error code is stored or logged: messages can carry phones. */
function errorCode(e: unknown): string {
  return e instanceof LoyaltyApiError ? e.code : "internal_error";
}

function getRow(customerId: string, slot: BonusSlot): BonusRow | undefined {
  return db().prepare("SELECT * FROM loyalty_bonus WHERE customer_id = ? AND slot = ?").get(customerId, slot) as
    | BonusRow
    | undefined;
}

function setStatus(customerId: string, slot: BonusSlot, status: "pending" | "done" | "failed", now = new Date()): void {
  db()
    .prepare("UPDATE loyalty_bonus SET status = ?, updated_at = ? WHERE customer_id = ? AND slot = ?")
    .run(status, now.toISOString(), customerId, slot);
}

function recordFailure(customerId: string, slot: BonusSlot, e: unknown): void {
  const code = errorCode(e);
  console.error("[loyalty] bonus failed", { customerId, slot, code });
  db()
    .prepare(
      "UPDATE loyalty_bonus SET attempts = attempts + 1, last_error = ?, updated_at = ? WHERE customer_id = ? AND slot = ?",
    )
    .run(code, new Date().toISOString(), customerId, slot);
}

/** True when nobody has claimed this slot yet. */
export function bonusSlotFree(customerId: string, slot: BonusSlot): boolean {
  try {
    return !getRow(customerId, slot);
  } catch (e) {
    console.error("[loyalty] bonus slot check failed", { code: errorCode(e) });
    return false;
  }
}

/** Reserve the slot. Needs the feature on, the card on, and a paid order that is not canceled. */
export function claimBonus(customerId: string, slot: BonusSlot): boolean {
  try {
    if (!dateRewardsEnabled() || !loyaltyEnabled()) return false;
    if (getRow(customerId, slot)) return false;
    const paid = db()
      .prepare(
        "SELECT 1 FROM orders WHERE customer_id = ? AND payment_status = 'paid' AND fulfillment_status <> 'canceled' LIMIT 1",
      )
      .get(customerId);
    if (!paid) return false;
    const now = new Date().toISOString();
    const res = db()
      .prepare(
        `INSERT OR IGNORE INTO loyalty_bonus (customer_id, slot, status, created_at, updated_at)
         VALUES (?, ?, 'pending', ?, ?)`,
      )
      .run(customerId, slot, now, now);
    return res.changes > 0;
  } catch (e) {
    console.error("[loyalty] bonus claim failed", { code: errorCode(e) });
    return false;
  }
}

/** Send the stamp for a claimed slot. Never throws. */
export async function runBonus(customerId: string, slot: BonusSlot): Promise<void> {
  try {
    const row = getRow(customerId, slot);
    if (!row || row.status !== "pending") return;
    try {
      const customer = db().prepare("SELECT phone FROM customers WHERE id = ?").get(customerId) as
        | { phone: string }
        | undefined;
      if (!customer) {
        db().prepare("DELETE FROM loyalty_bonus WHERE customer_id = ? AND slot = ?").run(customerId, slot);
        return;
      }
      const card = await lookupCustomer(e164(customer.phone), { timeoutMs: CALL_TIMEOUT_MS });
      if (!card) {
        // The card may be about to be created by an order still being registered: wait for it.
        const waiting = db()
          .prepare(
            `SELECT 1 FROM loyalty_sync s JOIN orders o ON o.id = s.order_id
             WHERE o.customer_id = ? AND s.kind = 'sync' AND s.status = 'pending' LIMIT 1`,
          )
          .get(customerId);
        if (!waiting) {
          db().prepare("DELETE FROM loyalty_bonus WHERE customer_id = ? AND slot = ?").run(customerId, slot);
        }
        return;
      }
      await addBonus(card.id, `diva-dato-${slot}-${card.id}`, NOTES[slot], { timeoutMs: CALL_TIMEOUT_MS });
      setStatus(customerId, slot, "done");
    } catch (e) {
      recordFailure(customerId, slot, e);
    }
  } catch (e) {
    console.error("[loyalty] runBonus failed", { customerId, slot, code: errorCode(e) });
  }
}

/** Retry everything still pending; give up on rows older than 72 hours. */
export async function runDueBonuses(now: Date = new Date()): Promise<{ done: number; pending: number; failed: number }> {
  const counts = { done: 0, pending: 0, failed: 0 };
  try {
    const rows = db()
      .prepare("SELECT customer_id, slot, created_at FROM loyalty_bonus WHERE status = 'pending' ORDER BY created_at")
      .all() as Pick<BonusRow, "customer_id" | "slot" | "created_at">[];
    for (const r of rows) {
      try {
        if (now.getTime() - Date.parse(r.created_at) > GIVE_UP_AFTER_MS) {
          const res = db()
            .prepare(
              "UPDATE loyalty_bonus SET status = 'failed', updated_at = ? WHERE customer_id = ? AND slot = ? AND status = 'pending'",
            )
            .run(now.toISOString(), r.customer_id, r.slot);
          if (res.changes > 0) {
            counts.failed++;
            console.error("[loyalty] bonus gave up after 72h", { customerId: r.customer_id, slot: r.slot });
          }
          continue;
        }
        await runBonus(r.customer_id, r.slot);
        const after = getRow(r.customer_id, r.slot)?.status;
        if (after === "done") counts.done++;
        else if (after === "pending") counts.pending++;
      } catch (e) {
        console.error("[loyalty] due bonus failed", { customerId: r.customer_id, code: errorCode(e) });
      }
    }
  } catch (e) {
    console.error("[loyalty] runDueBonuses failed", { code: errorCode(e) });
  }
  return counts;
}
