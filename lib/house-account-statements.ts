// A statement is an immutable snapshot of the account at a period close. It
// bills every entry not yet on a statement up to period_end; opening is the
// previous statement's closing, so closing is always the running balance.
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addDaysStr, shopDateStr } from "@/lib/tv-slots";
import { generateCode } from "@/lib/short-code";
import { getAccount, newId, rowToAccount } from "@/lib/house-account-storage";
import { isIssueDay, scheduleFromPlan } from "@/lib/house-account-plan";
import { enqueue, cancelForStatement } from "@/lib/house-account-sends";
import { recomputeSettlement, entryDate } from "@/lib/house-account-settlement";
import type { HouseAccount, Statement, StatementLine, StatementStatus, EntryKind } from "@/types/house-account";

type Row = {
  id: string; account_id: string; number: string; code: string; period_start: string; period_end: string;
  issued_at: string; due_date: string; opening_cents: number; charges_cents: number; credits_cents: number;
  payments_cents: number; closing_cents: number; settled_cents: number; status: string; lines_json: string; created_at: string;
};
type EntryRow = { id: string; kind: string; amount_cents: number; order_id: string | null; method: string | null; note: string | null; created_at: string };

function rowToStatement(r: Row): Statement {
  return {
    id: r.id, accountId: r.account_id, number: r.number, code: r.code,
    periodStart: r.period_start, periodEnd: r.period_end, issuedAt: r.issued_at, dueDate: r.due_date,
    openingCents: r.opening_cents, chargesCents: r.charges_cents, creditsCents: r.credits_cents,
    paymentsCents: r.payments_cents, closingCents: r.closing_cents, settledCents: r.settled_cents,
    status: r.status as StatementStatus, lines: JSON.parse(r.lines_json) as StatementLine[], createdAt: r.created_at,
  };
}

export function getStatement(id: string): Statement | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM house_account_statements WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToStatement(row) : null;
}

export function getStatementByCode(code: string): Statement | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM house_account_statements WHERE code = ?").get(code) as Row | undefined;
  return row ? rowToStatement(row) : null;
}

export function listStatements(accountId: string): Statement[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM house_account_statements WHERE account_id = ? ORDER BY period_end DESC, created_at DESC")
    .all(accountId) as Row[];
  return rows.map(rowToStatement);
}

export function latestStatement(accountId: string): Statement | null {
  runMigrations();
  const row = getDb()
    .prepare("SELECT * FROM house_account_statements WHERE account_id = ? AND status != 'void' ORDER BY period_end DESC, created_at DESC LIMIT 1")
    .get(accountId) as Row | undefined;
  return row ? rowToStatement(row) : null;
}

function nextStatementNumber(): string {
  const db = getDb();
  db.prepare("UPDATE statement_number_seq SET last_value = last_value + 1").run();
  const row = db.prepare("SELECT last_value AS n FROM statement_number_seq").get() as { n: number } | undefined;
  if (!row) throw new Error("statement_number_seq row missing");
  return `ST-${row.n}`;
}

function uniqueCode(): string {
  const db = getDb();
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    if (!db.prepare("SELECT 1 FROM house_account_statements WHERE code = ?").get(code)) return code;
  }
  throw new Error("could not allocate a unique statement code");
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo", zelle: "Zelle", ach: "ACH", check: "Cheque", "card-terminal": "Tarjeta", stripe: "Tarjeta (en línea)",
};

function buildLines(entries: EntryRow[]): StatementLine[] {
  const ids = entries.map((e) => e.order_id).filter((x): x is string => !!x);
  const orders = new Map<string, { order_number: number | null; recipient_name: string }>();
  if (ids.length) {
    const rows = getDb()
      .prepare(`SELECT id, order_number, recipient_name FROM orders WHERE id IN (${ids.map(() => "?").join(",")})`)
      .all(...ids) as { id: string; order_number: number | null; recipient_name: string }[];
    for (const r of rows) orders.set(r.id, r);
  }
  return entries.map((e) => {
    const o = e.order_id ? orders.get(e.order_id) : undefined;
    const num = o?.order_number != null ? `#${o.order_number}` : e.order_id ? `#${e.order_id.slice(-6)}` : "";
    let label: string;
    switch (e.kind as EntryKind) {
      case "charge": label = `Orden ${num}${o ? ` · ${o.recipient_name}` : ""}`; break;
      case "payment": label = `Pago${e.method ? ` · ${METHOD_LABEL[e.method] ?? e.method}` : ""}`; break;
      case "credit": label = `Crédito${e.note ? ` · ${e.note}` : ""}`; break;
      case "adjustment": label = `Ajuste${num ? ` ${num}` : ""}${e.note ? ` · ${e.note}` : ""}`; break;
      case "reversal": label = `Cancelación ${num}`; break;
    }
    return {
      date: entryDate(e.created_at),
      kind: e.kind as EntryKind,
      label,
      ...(e.order_id ? { orderId: e.order_id } : {}),
      ...(o?.order_number != null ? { orderNumber: o.order_number } : {}),
      amountCents: e.amount_cents,
    };
  });
}

/**
 * Close the account's period ending `periodEnd` (YYYY-MM-DD). Returns null when
 * there is nothing to bill (no unbilled entries and no balance carried) or when
 * a live statement already covers that period.
 */
export function issueStatement(accountId: string, periodEnd: string, opts: { today?: string } = {}): Statement | null {
  runMigrations();
  const account = getAccount(accountId);
  if (!account) throw new Error("account_not_found");
  const today = opts.today ?? shopDateStr(new Date());
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const prev = latestStatement(accountId);
    const periodStart = prev ? addDaysStr(prev.periodEnd, 1) : shopDateStr(new Date(account.createdAt));
    if (periodStart > periodEnd) { db.exec("COMMIT"); return null; }
    const unbilled = db.prepare(
      `SELECT id, kind, amount_cents, order_id, method, note, created_at FROM house_account_entries
       WHERE account_id = ? AND statement_id IS NULL ORDER BY created_at ASC, rowid ASC`,
    ).all(accountId) as EntryRow[];
    const entries = unbilled.filter((e) => entryDate(e.created_at) <= periodEnd);
    const opening = prev?.closingCents ?? 0;
    if (entries.length === 0 && opening <= 0) { db.exec("COMMIT"); return null; }

    let charges = 0, credits = 0, payments = 0;
    for (const e of entries) {
      if (e.amount_cents > 0) charges += e.amount_cents;
      else if (e.kind === "payment") payments += -e.amount_cents;
      else credits += -e.amount_cents;
    }
    const closing = opening + charges - credits - payments;
    const id = newId("hst");
    const now = new Date().toISOString();
    const dueDate = addDaysStr(today, account.termsDays);
    db.prepare(
      `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
         opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'open', ?, ?)`,
    ).run(id, accountId, nextStatementNumber(), uniqueCode(), periodStart, periodEnd, now, dueDate,
      opening, charges, credits, payments, closing, JSON.stringify(buildLines(entries)), now);
    if (entries.length) {
      db.prepare(`UPDATE house_account_entries SET statement_id = ? WHERE id IN (${entries.map(() => "?").join(",")})`)
        .run(id, ...entries.map((e) => e.id));
    }
    recomputeSettlement(accountId);
    const fresh = getStatement(id)!;
    if (fresh.status === "open") {
      enqueue(scheduleFromPlan({
        today, dueDate, statementChannel: account.statementChannel, reminderPlan: account.reminderPlan,
      }).map((p) => ({ accountId, statementId: id, ...p })));
    }
    db.exec("COMMIT");
    return fresh;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Active accounts whose issue day is `today` and that have no live statement closing yesterday or later. */
export function accountsDueToIssue(today: string): HouseAccount[] {
  runMigrations();
  const db = getDb();
  const rows = db.prepare("SELECT * FROM house_accounts WHERE status = 'active' ORDER BY name").all() as Parameters<typeof rowToAccount>[0][];
  const yesterday = addDaysStr(today, -1);
  const has = db.prepare(
    "SELECT 1 FROM house_account_statements WHERE account_id = ? AND status != 'void' AND period_end >= ? LIMIT 1",
  );
  return rows.map(rowToAccount).filter((a) => isIssueDay(a, today) && !has.get(a.id, yesterday));
}

export function voidStatement(id: string): Statement {
  runMigrations();
  const s = getStatement(id);
  if (!s) throw new Error("statement_not_found");
  if (s.status === "void") return s;
  if (s.status === "paid") throw new Error("statement_paid");
  const latest = latestStatement(s.accountId);
  if (latest && latest.id !== s.id) throw new Error("not_latest");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE house_account_entries SET statement_id = NULL WHERE statement_id = ?").run(id);
    db.prepare("UPDATE house_account_statements SET status = 'void' WHERE id = ?").run(id);
    cancelForStatement(id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return getStatement(id)!;
}
