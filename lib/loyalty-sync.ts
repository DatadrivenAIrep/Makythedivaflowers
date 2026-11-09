import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getOrder } from "@/lib/order-storage";
import { notifyOwner } from "@/lib/notify-owner";
import { sendSms, e164 } from "@/lib/twilio-server";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";
import { OPT_OUT_FOOTER } from "@/lib/campaign-sender";
import {
  loyaltyEnabled,
  LoyaltyApiError,
  lookupCustomer,
  createCustomer,
  redeemReward,
  addStamp,
  reverseOrder,
} from "@/lib/loyalty-client";
import type { Order } from "@/types/order";

/**
 * Registers a paid web order on the customer's loyalty card (redeem the reward
 * chosen at checkout, then add a stamp) and, when the order is canceled, undoes it.
 *
 * Work is queued in `loyalty_sync` before anything is attempted, so a program
 * outage only delays the stamp. Every call carries the same `loyalty_order_id`
 * and the program de-duplicates on it, which is why a retry can simply repeat
 * every step with no per-step state kept here.
 *
 * Nothing exported here throws: these run on payment and cancel paths.
 */

const CALL_TIMEOUT_MS = 10_000;
const GIVE_UP_AFTER_MS = 72 * 3600_000;
/** Marker kept in last_error once the owner was told the reward was already used. */
const REWARD_NOTICE = "reward_unavailable";

type Kind = "sync" | "reverse";
type Status = "pending" | "done" | "noop" | "failed" | "canceled";
type SyncRow = {
  order_id: string;
  kind: Kind;
  loyalty_order_id: string;
  status: Status;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

function db() {
  runMigrations();
  return getDb();
}

function getRow(orderId: string, kind: Kind): SyncRow | undefined {
  return db().prepare("SELECT * FROM loyalty_sync WHERE order_id = ? AND kind = ?").get(orderId, kind) as
    | SyncRow
    | undefined;
}

function setStatus(orderId: string, kind: Kind, status: Status): void {
  db()
    .prepare("UPDATE loyalty_sync SET status = ?, updated_at = ? WHERE order_id = ? AND kind = ?")
    .run(status, new Date().toISOString(), orderId, kind);
}

/** Only the error code is stored or logged: messages can carry phones or reward codes. */
function errorInfo(e: unknown): { name: string; code: string; status: number } {
  if (e instanceof LoyaltyApiError) return { name: e.name, code: e.code, status: e.status };
  return { name: e instanceof Error ? e.name : "UnknownError", code: "internal_error", status: 0 };
}

function recordFailure(row: SyncRow, e: unknown): void {
  const info = errorInfo(e);
  console.error("[loyalty] sync step failed", { orderId: row.order_id, kind: row.kind, ...info });
  // Keep the "owner already told" marker so a retry does not tell them twice.
  const code = row.last_error?.startsWith(REWARD_NOTICE) ? `${REWARD_NOTICE}>${info.code}` : info.code;
  db()
    .prepare(
      "UPDATE loyalty_sync SET attempts = attempts + 1, last_error = ?, updated_at = ? WHERE order_id = ? AND kind = ?",
    )
    .run(code, new Date().toISOString(), row.order_id, row.kind);
}

function orderRef(order: Order | null | undefined, fallback: string): string {
  if (!order) return fallback;
  return order.orderNumber != null ? `#${order.orderNumber}` : order.id;
}

async function refFor(orderId: string): Promise<string> {
  try {
    return orderRef(await getOrder(orderId), orderId);
  } catch {
    return orderId;
  }
}

/** Queue the stamp for a paid web order. Idempotent per order. */
export function enqueueOrderSync(order: Order): void {
  try {
    if (!loyaltyEnabled() || order.source !== "web" || order.paymentStatus !== "paid") return;
    const now = new Date().toISOString();
    db()
      .prepare(
        `INSERT OR IGNORE INTO loyalty_sync (order_id, kind, loyalty_order_id, status, created_at, updated_at)
         VALUES (?, 'sync', ?, 'pending', ?, ?)`,
      )
      .run(order.id, `diva-${order.orderNumber ?? order.id}`, now, now);
  } catch (e) {
    console.error("[loyalty] enqueue sync failed", errorInfo(e));
  }
}

/** Queue the undo of a canceled order, only if something was registered for it. */
export function enqueueOrderReverse(orderId: string): void {
  try {
    const sync = getRow(orderId, "sync");
    if (!sync || sync.status === "noop") return;
    const now = new Date().toISOString();
    db()
      .prepare(
        `INSERT OR IGNORE INTO loyalty_sync (order_id, kind, loyalty_order_id, status, created_at, updated_at)
         VALUES (?, 'reverse', ?, 'pending', ?, ?)`,
      )
      .run(orderId, sync.loyalty_order_id, now, now);
  } catch (e) {
    console.error("[loyalty] enqueue reverse failed", errorInfo(e));
  }
}

async function sendCardLink(order: Order, cardUrl: string): Promise<void> {
  try {
    const locale = order.locale === "en" ? "en" : "es";
    const body =
      locale === "es"
        ? `Ya tienes tu tarjeta de Diva Flowers: ${cardUrl}`
        : `Your Diva Flowers card is ready: ${cardUrl}`;
    if (!twilioSmsEnabled() || twilioDryRun()) {
      console.log(JSON.stringify({ event: "loyalty_card_sms_dry_run", orderId: order.id }));
      return;
    }
    await sendSms(e164(order.contact.phone), `${body} ${OPT_OUT_FOOTER[locale]}`);
  } catch (e) {
    // A courtesy text must never hold back the stamp.
    console.error("[loyalty] card link sms failed", { orderId: order.id, ...errorInfo(e) });
  }
}

async function syncSteps(row: SyncRow, order: Order): Promise<void> {
  const opts = { timeoutMs: CALL_TIMEOUT_MS };
  const phone = e164(order.contact.phone);

  let customer = await lookupCustomer(phone, opts);
  if (!customer) {
    const name = order.contact.name?.trim() ?? "";
    if (!order.loyaltyJoin || !name) {
      setStatus(row.order_id, "sync", "noop");
      return;
    }
    const created = await createCustomer({ name, phone }, opts);
    customer = created.customer;
    if (!created.existing && order.smsConsent) await sendCardLink(order, customer.cardUrl);
  }

  if (order.loyaltyRewardId) {
    try {
      await redeemReward(customer.id, order.loyaltyRewardId, row.loyalty_order_id, opts);
    } catch (e) {
      if (!(e instanceof LoyaltyApiError) || e.code !== "reward_unavailable") throw e;
      // Already used elsewhere; the discount was honoured at checkout, so only tell the owner.
      if (!row.last_error?.startsWith(REWARD_NOTICE)) {
        db()
          .prepare("UPDATE loyalty_sync SET last_error = ? WHERE order_id = ? AND kind = 'sync'")
          .run(REWARD_NOTICE, row.order_id);
        row.last_error = REWARD_NOTICE;
        await notifyOwner(
          `Orden ${orderRef(order, row.order_id)}: el premio "${order.loyaltyRewardLabel ?? ""}" ya se había usado al pagar. Se respetó el descuento. — Diva Flowers`,
        );
      }
    }
  }

  await addStamp(customer.id, row.loyalty_order_id, opts);
  setStatus(row.order_id, "sync", "done");
}

/** Run the queued stamp for one order. Never throws. */
export async function runSync(orderId: string): Promise<void> {
  try {
    const row = getRow(orderId, "sync");
    if (!row || row.status !== "pending") return;
    if (getRow(orderId, "reverse")) {
      setStatus(orderId, "sync", "canceled");
      return;
    }
    try {
      const order = await getOrder(orderId);
      if (!order) return;
      await syncSteps(row, order);
    } catch (e) {
      recordFailure(row, e);
    }
  } catch (e) {
    console.error("[loyalty] runSync failed", { orderId, ...errorInfo(e) });
  }
}

/** Undo a canceled order on the card. Never throws. */
export async function runReverse(orderId: string): Promise<void> {
  try {
    const row = getRow(orderId, "reverse");
    if (!row || row.status !== "pending") return;
    try {
      let used: { reward: string }[] = [];
      try {
        used = (await reverseOrder(row.loyalty_order_id, { timeoutMs: CALL_TIMEOUT_MS })).rewardsAlreadyUsed;
      } catch (e) {
        // The program never saw the order, so there is nothing to undo.
        if (!(e instanceof LoyaltyApiError) || e.code !== "order_not_found") throw e;
      }
      setStatus(orderId, "reverse", "done");
      if (used.length > 0) {
        await notifyOwner(
          `Orden ${await refFor(orderId)} cancelada: ya se usaron premios ganados con ella (${used
            .map((r) => r.reward)
            .join(", ")}). — Diva Flowers`,
        );
      }
    } catch (e) {
      recordFailure(row, e);
    }
  } catch (e) {
    console.error("[loyalty] runReverse failed", { orderId, ...errorInfo(e) });
  }
}

/** Retry everything still pending; give up on rows older than 72 hours. */
export async function runDuePending(now: Date = new Date()): Promise<{ done: number; pending: number; failed: number }> {
  const counts = { done: 0, pending: 0, failed: 0 };
  try {
    const rows = db()
      .prepare("SELECT order_id, kind, created_at FROM loyalty_sync WHERE status = 'pending' ORDER BY created_at")
      .all() as Pick<SyncRow, "order_id" | "kind" | "created_at">[];
    for (const r of rows) {
      try {
        if (now.getTime() - Date.parse(r.created_at) > GIVE_UP_AFTER_MS) {
          const res = db()
            .prepare(
              "UPDATE loyalty_sync SET status = 'failed', updated_at = ? WHERE order_id = ? AND kind = ? AND status = 'pending'",
            )
            .run(now.toISOString(), r.order_id, r.kind);
          if (res.changes > 0) {
            counts.failed++;
            await notifyOwner(
              `Tarjeta: la orden ${await refFor(r.order_id)} no se pudo registrar en 72 horas. — Diva Flowers`,
            );
          }
          continue;
        }
        if (r.kind === "sync") await runSync(r.order_id);
        else await runReverse(r.order_id);
        const after = getRow(r.order_id, r.kind)?.status;
        if (after === "done" || after === "noop") counts.done++;
        else if (after === "pending") counts.pending++;
      } catch (e) {
        console.error("[loyalty] due row failed", { orderId: r.order_id, ...errorInfo(e) });
      }
    }
  } catch (e) {
    console.error("[loyalty] runDuePending failed", errorInfo(e));
  }
  return counts;
}
