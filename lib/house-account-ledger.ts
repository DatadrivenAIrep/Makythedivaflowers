// The account ledger. Every money movement is an append-only entry; payments
// and credits are spread over the account's open orders oldest-first so the
// per-order views (drawer, Bandeja, metrics) stay right without changes.
import "server-only";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { allocate, type Allocation } from "@/lib/house-account-allocate";
import { recomputeSettlement } from "@/lib/house-account-settlement";
import { getAccount, newId, accountBalanceCents } from "@/lib/house-account-storage";
import type { LedgerEntry, EntryKind, AccountPaymentMethod } from "@/types/house-account";

const PAYMENT_METHODS: AccountPaymentMethod[] = ["cash", "zelle", "ach", "check", "card-terminal", "stripe"];

type EntryRow = {
  id: string; account_id: string; kind: string; amount_cents: number; order_id: string | null;
  statement_id: string | null; method: string | null; stripe_session_id: string | null;
  note: string | null; actor: string; created_at: string;
};

function rowToEntry(r: EntryRow): LedgerEntry {
  return {
    id: r.id,
    accountId: r.account_id,
    kind: r.kind as EntryKind,
    amountCents: r.amount_cents,
    orderId: r.order_id ?? undefined,
    statementId: r.statement_id ?? undefined,
    method: (r.method as AccountPaymentMethod | null) ?? undefined,
    stripeSessionId: r.stripe_session_id ?? undefined,
    note: r.note ?? undefined,
    actor: r.actor,
    createdAt: r.created_at,
  };
}

function money(c: number): string { return `$${(c / 100).toFixed(2)}`; }

function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function getEntry(id: string): LedgerEntry | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM house_account_entries WHERE id = ?").get(id) as EntryRow | undefined;
  return row ? rowToEntry(row) : null;
}

export function listEntries(accountId: string): LedgerEntry[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM house_account_entries WHERE account_id = ? ORDER BY created_at ASC, rowid ASC")
    .all(accountId) as EntryRow[];
  return rows.map(rowToEntry);
}

export function entriesForOrder(orderId: string): LedgerEntry[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM house_account_entries WHERE order_id = ? ORDER BY created_at ASC, rowid ASC")
    .all(orderId) as EntryRow[];
  return rows.map(rowToEntry);
}

type InsertInput = {
  accountId: string; kind: EntryKind; amountCents: number; orderId?: string;
  method?: AccountPaymentMethod; stripeSessionId?: string; note?: string; actor: string;
};

/** Returns null only when an INSERT OR IGNORE (Stripe session) hit a duplicate. */
function insertEntry(input: InsertInput): LedgerEntry | null {
  const id = newId("hae");
  const sql = `INSERT ${input.stripeSessionId ? "OR IGNORE " : ""}INTO house_account_entries
      (id, account_id, kind, amount_cents, order_id, method, stripe_session_id, note, actor, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const res = getDb().prepare(sql).run(
    id, input.accountId, input.kind, input.amountCents, input.orderId ?? null, input.method ?? null,
    input.stripeSessionId ?? null, input.note ?? null, input.actor, new Date().toISOString(),
  );
  return res.changes === 0 ? null : getEntry(id);
}

type OpenOrderRow = { id: string; total_cents: number; amount_paid_cents: number };

function openOrders(accountId: string, excludeOrderId?: string): OpenOrderRow[] {
  return getDb().prepare(
    `SELECT id, total_cents, amount_paid_cents FROM orders
     WHERE house_account_id = ? AND payment_status = 'pending' AND fulfillment_status != 'canceled'
       ${excludeOrderId ? "AND id != ?" : ""}
     ORDER BY created_at ASC, rowid ASC`,
  ).all(...(excludeOrderId ? [accountId, excludeOrderId] : [accountId])) as OpenOrderRow[];
}

function insertOrderChange(orderId: string, actor: string, kind: "payment" | "house_account", summary: string): void {
  getDb().prepare(
    `INSERT INTO order_changes (id, order_id, at, actor, kind, summary, changes_json) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(crypto.randomUUID(), orderId, new Date().toISOString(), actor, kind, summary);
}

/** Spread `amountCents` over the account's open orders; updates orders + order_changes. */
function applyToOrders(accountId: string, amountCents: number, entryId: string, actor: string, excludeOrderId?: string): Allocation[] {
  const rows = openOrders(accountId, excludeOrderId);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const allocations = allocate(rows.map((r) => ({ id: r.id, dueCents: r.total_cents - r.amount_paid_cents })), amountCents);
  const db = getDb();
  const now = new Date().toISOString();
  for (const a of allocations) {
    const o = byId.get(a.id)!;
    const paid = o.amount_paid_cents + a.appliedCents;
    const full = paid >= o.total_cents;
    db.prepare(
      `UPDATE orders SET amount_paid_cents = ?, payment_status = ?, paid_at = CASE WHEN ? THEN COALESCE(paid_at, ?) ELSE paid_at END, updated_at = ? WHERE id = ?`,
    ).run(paid, full ? "paid" : "pending", full ? 1 : 0, now, now, a.id);
    insertOrderChange(a.id, actor, "payment",
      `Pago de cuenta ${money(a.appliedCents)}${full ? " · pagada" : ` · saldo ${money(o.total_cents - paid)}`} · ${entryId}`);
  }
  return allocations;
}

function assertAccount(accountId: string) {
  const a = getAccount(accountId);
  if (!a) throw new Error("account_not_found");
  return a;
}
function assertPositiveInt(n: number) {
  if (!Number.isInteger(n) || n <= 0) throw new Error("invalid_amount");
}
function assertNote(note: string | undefined): string {
  const t = note?.trim();
  if (!t) throw new Error("note_required");
  return t;
}

/** Appends a charge; consumes any credit the account already had (oldest open order first). */
export function recordCharge(i: { accountId: string; orderId: string; amountCents: number; note?: string; actor: string }): LedgerEntry {
  runMigrations();
  assertPositiveInt(i.amountCents);
  assertAccount(i.accountId);
  return tx(() => {
    const balanceBefore = accountBalanceCents(i.accountId);
    const e = insertEntry({ accountId: i.accountId, kind: "charge", amountCents: i.amountCents, orderId: i.orderId, note: i.note, actor: i.actor })!;
    if (balanceBefore < 0) applyToOrders(i.accountId, Math.min(-balanceBefore, i.amountCents), e.id, i.actor);
    recomputeSettlement(i.accountId);
    return e;
  });
}

export type PaymentResult = { entry: LedgerEntry | null; allocations: Allocation[] };

export function recordPayment(i: {
  accountId: string; amountCents: number; method: AccountPaymentMethod; note?: string; actor: string; stripeSessionId?: string;
}): PaymentResult {
  runMigrations();
  assertPositiveInt(i.amountCents);
  if (!PAYMENT_METHODS.includes(i.method)) throw new Error("invalid_method");
  assertAccount(i.accountId);
  return tx(() => {
    const entry = insertEntry({
      accountId: i.accountId, kind: "payment", amountCents: -i.amountCents, method: i.method,
      stripeSessionId: i.stripeSessionId, note: i.note, actor: i.actor,
    });
    if (!entry) return { entry: null, allocations: [] }; // duplicate Stripe session: already recorded
    const allocations = applyToOrders(i.accountId, i.amountCents, entry.id, i.actor);
    recomputeSettlement(i.accountId);
    return { entry, allocations };
  });
}

export function recordCredit(i: { accountId: string; amountCents: number; note: string; actor: string }): PaymentResult {
  runMigrations();
  assertPositiveInt(i.amountCents);
  const note = assertNote(i.note);
  assertAccount(i.accountId);
  return tx(() => {
    const entry = insertEntry({ accountId: i.accountId, kind: "credit", amountCents: -i.amountCents, note, actor: i.actor })!;
    const allocations = applyToOrders(i.accountId, i.amountCents, entry.id, i.actor);
    recomputeSettlement(i.accountId);
    return { entry, allocations };
  });
}

/**
 * Signed. An order-bound adjustment (an edit of an account order's total) keeps
 * its own order's payment fields in sync: covered → paid, no longer covered → pending.
 * When a lowered total caps amount_paid, the excess freed is applied to the account's
 * OTHER open orders oldest-first, the way a cancel reversal applies freed money.
 * A positive order-bound adjustment consumes any credit the account already had
 * (oldest open order first, after its own order is reopened), the way a charge does.
 */
export function recordAdjustment(i: { accountId: string; amountCents: number; orderId?: string; note: string; actor: string }): LedgerEntry {
  runMigrations();
  if (!Number.isInteger(i.amountCents) || i.amountCents === 0) throw new Error("invalid_amount");
  const note = assertNote(i.note);
  assertAccount(i.accountId);
  return tx(() => {
    const balanceBefore = i.orderId && i.amountCents > 0 ? accountBalanceCents(i.accountId) : 0;
    const e = insertEntry({ accountId: i.accountId, kind: "adjustment", amountCents: i.amountCents, orderId: i.orderId, note, actor: i.actor })!;
    if (i.orderId) {
      syncOrderPaymentFields(i.orderId, i.accountId, e.id, i.actor);
      if (i.amountCents > 0 && balanceBefore < 0) applyToOrders(i.accountId, Math.min(-balanceBefore, i.amountCents), e.id, i.actor);
    }
    recomputeSettlement(i.accountId);
    return e;
  });
}

function syncOrderPaymentFields(orderId: string, accountId: string, entryId: string, actor: string): void {
  const db = getDb();
  const o = db.prepare("SELECT amount_paid_cents, total_cents, payment_status, fulfillment_status FROM orders WHERE id = ?")
    .get(orderId) as { amount_paid_cents: number; total_cents: number; payment_status: string; fulfillment_status: string } | undefined;
  if (!o || o.fulfillment_status === "canceled") return;
  const now = new Date().toISOString();
  if (o.amount_paid_cents >= o.total_cents) {
    const excess = o.amount_paid_cents - o.total_cents; // measured before the cap
    db.prepare(
      `UPDATE orders SET payment_status = 'paid', paid_at = COALESCE(paid_at, ?), amount_paid_cents = ?, updated_at = ? WHERE id = ?`,
    ).run(now, o.total_cents, now, orderId);
    if (excess > 0) applyToOrders(accountId, excess, entryId, actor, orderId);
  } else if (o.payment_status === "paid") {
    db.prepare("UPDATE orders SET payment_status = 'pending', paid_at = NULL, updated_at = ? WHERE id = ?").run(now, orderId);
  }
}

/** Signed net of every entry of `orderId` on `accountId` (charges, adjustments, reversals). */
function orderNetOnAccount(orderId: string, accountId: string): { net: number; rows: LedgerEntry[] } {
  const rows = entriesForOrder(orderId).filter((r) => r.accountId === accountId);
  return { net: rows.reduce((s, r) => s + r.amountCents, 0), rows };
}

/** Cancel hook: reverse whatever the order still nets on its current account; free only money already applied to it. */
export function reverseOrderCharge(orderId: string, actor: string): LedgerEntry | null {
  runMigrations();
  return tx(() => {
    const o = getDb().prepare("SELECT amount_paid_cents, total_cents, house_account_id FROM orders WHERE id = ?")
      .get(orderId) as { amount_paid_cents: number; total_cents: number; house_account_id: string | null } | undefined;
    if (!o?.house_account_id) return null;
    const accountId = o.house_account_id;
    const { net: sum } = orderNetOnAccount(orderId, accountId);
    if (sum <= 0) return null;
    // Only money that reached this order THROUGH the account is freed. A cash
    // deposit taken before "Pasar a cuenta" never touched the ledger: the charge
    // was total − deposit, so deposit = total − S and account money = paid − deposit.
    const freed = Math.max(0, Math.min(sum, o.amount_paid_cents + sum - o.total_cents));
    const e = insertEntry({ accountId, kind: "reversal", amountCents: -sum, orderId, note: "Orden cancelada", actor })!;
    if (freed > 0) applyToOrders(accountId, freed, e.id, actor, orderId);
    recomputeSettlement(accountId);
    return e;
  });
}

/** Edit hook: a changed total on an account order becomes a signed adjustment. */
export function syncOrderTotal(orderId: string, beforeCents: number, afterCents: number, actor: string): LedgerEntry | null {
  runMigrations();
  const delta = afterCents - beforeCents;
  if (delta === 0) return null;
  const row = getDb().prepare("SELECT house_account_id FROM orders WHERE id = ?").get(orderId) as { house_account_id: string | null } | undefined;
  if (!row?.house_account_id) return null;
  return recordAdjustment({
    accountId: row.house_account_id, amountCents: delta, orderId,
    note: `Edición de orden: ${money(beforeCents)} → ${money(afterCents)}`, actor,
  });
}

type OrderRowLite = {
  id: string; total_cents: number; amount_paid_cents: number; payment_status: string;
  fulfillment_status: string; house_account_id: string | null;
};
function orderRow(orderId: string): OrderRowLite {
  const row = getDb()
    .prepare("SELECT id, total_cents, amount_paid_cents, payment_status, fulfillment_status, house_account_id FROM orders WHERE id = ?")
    .get(orderId) as OrderRowLite | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  return row;
}

export function moveOrderToAccount(orderId: string, accountId: string, actor: string): LedgerEntry {
  runMigrations();
  const account = assertAccount(accountId);
  if (account.status !== "active") throw new Error("account_inactive");
  return tx(() => {
    const o = orderRow(orderId);
    if (o.house_account_id) throw new Error("already_on_account");
    if (o.payment_status !== "pending" || o.fulfillment_status === "canceled") throw new Error("not_pending");
    const remaining = o.total_cents - o.amount_paid_cents;
    if (remaining <= 0) throw new Error("nothing_due");
    const balanceBefore = accountBalanceCents(accountId);
    const now = new Date().toISOString();
    getDb().prepare("UPDATE orders SET house_account_id = ?, payment_method = 'house-account', updated_at = ? WHERE id = ?")
      .run(accountId, now, orderId);
    const e = insertEntry({ accountId, kind: "charge", amountCents: remaining, orderId, note: "Pasada a cuenta", actor })!;
    if (balanceBefore < 0) applyToOrders(accountId, Math.min(-balanceBefore, remaining), e.id, actor);
    insertOrderChange(orderId, actor, "house_account", `Pasada a cuenta ${account.name} · ${money(remaining)}`);
    recomputeSettlement(accountId);
    return e;
  });
}

export function removeOrderFromAccount(orderId: string, actor: string): LedgerEntry {
  runMigrations();
  return tx(() => {
    const o = orderRow(orderId);
    if (!o.house_account_id) throw new Error("not_on_account");
    const accountId = o.house_account_id;
    // Only this account's rows: a re-move after an earlier remove leaves the
    // previous account's (netted-out) rows behind, and they are not this decision.
    const { net: sum, rows } = orderNetOnAccount(orderId, accountId);
    if (sum <= 0) throw new Error("not_on_account");
    if (rows.some((r) => r.statementId)) throw new Error("already_billed");
    // Money the account already put into this order (paid beyond any pre-move
    // deposit, which is total − S): removing would strand it.
    const accountMoney = Math.max(0, o.amount_paid_cents + sum - o.total_cents);
    if (accountMoney > 0) throw new Error("has_payments");
    // The latest charge is the live one (a re-move to the same account appends a new charge).
    const liveCharge = [...rows].reverse().find((r) => r.kind === "charge");
    if (liveCharge) {
      const later = getDb().prepare(
        "SELECT 1 FROM house_account_entries WHERE account_id = ? AND kind IN ('payment','credit') AND created_at >= ? LIMIT 1",
      ).get(accountId, liveCharge.createdAt);
      if (later) throw new Error("has_payments");
    }
    const now = new Date().toISOString();
    const e = insertEntry({ accountId, kind: "reversal", amountCents: -sum, orderId, note: "Quitada de cuenta", actor })!;
    getDb().prepare("UPDATE orders SET house_account_id = NULL, payment_method = NULL, updated_at = ? WHERE id = ?").run(now, orderId);
    insertOrderChange(orderId, actor, "house_account", `Quitada de cuenta · ${money(sum)}`);
    recomputeSettlement(accountId);
    return e;
  });
}

/** Webhook entry point. Idempotent by Stripe session id. */
export function recordStripeStatementPayment(i: { statementId: string; sessionId: string; amountCents: number }): PaymentResult | null {
  runMigrations();
  const st = getDb()
    .prepare("SELECT account_id, number FROM house_account_statements WHERE id = ?")
    .get(i.statementId) as { account_id: string; number: string } | undefined;
  if (!st) return null;
  return recordPayment({
    accountId: st.account_id, amountCents: i.amountCents, method: "stripe",
    note: `Stripe · ${st.number}`, actor: "stripe", stripeSessionId: i.sessionId,
  });
}
