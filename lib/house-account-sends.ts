// The statement/reminder queue. One row per planned message; the same row is
// the log once it has gone out. The cron claims a row before sending so a
// second run (retry, manual run) can never send it twice.
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addDaysStr } from "@/lib/tv-slots";
import { newId } from "@/lib/house-account-storage";
import type { ScheduledSend, SendChannel, SendKind, SendStatus } from "@/types/house-account";

type Row = {
  id: string; account_id: string; statement_id: string; kind: string; step_index: number | null;
  channel: string; scheduled_for: string; status: string; claimed_at: string | null; sent_at: string | null;
  sms_sid: string | null; email_id: string | null; body: string | null; error: string | null; created_at: string;
};

function rowToSend(r: Row): ScheduledSend {
  return {
    id: r.id,
    accountId: r.account_id,
    statementId: r.statement_id,
    kind: r.kind as SendKind,
    stepIndex: r.step_index ?? undefined,
    channel: r.channel as SendChannel,
    scheduledFor: r.scheduled_for,
    status: r.status as SendStatus,
    claimedAt: r.claimed_at ?? undefined,
    sentAt: r.sent_at ?? undefined,
    smsSid: r.sms_sid ?? undefined,
    emailId: r.email_id ?? undefined,
    body: r.body ?? undefined,
    error: r.error ?? undefined,
    createdAt: r.created_at,
  };
}

export type EnqueueInput = {
  accountId: string;
  statementId: string;
  kind: SendKind;
  stepIndex?: number;
  channel: SendChannel;
  scheduledFor: string;
};

export function enqueue(rows: EnqueueInput[]): ScheduledSend[] {
  runMigrations();
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO house_account_sends (id, account_id, statement_id, kind, step_index, channel, scheduled_for, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
  );
  const out: ScheduledSend[] = [];
  for (const r of rows) {
    const id = newId("hsd");
    insert.run(id, r.accountId, r.statementId, r.kind, r.stepIndex ?? null, r.channel, r.scheduledFor, new Date().toISOString());
    out.push(getSend(id)!);
  }
  return out;
}

export function getSend(id: string): ScheduledSend | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM house_account_sends WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToSend(row) : null;
}

export function dueSends(today: string): ScheduledSend[] {
  runMigrations();
  const rows = getDb().prepare(
    `SELECT s.* FROM house_account_sends s
       JOIN house_account_statements st ON st.id = s.statement_id
       JOIN house_accounts a ON a.id = s.account_id
     WHERE s.status = 'scheduled' AND s.scheduled_for <= ? AND st.status = 'open' AND a.status = 'active'
     ORDER BY s.scheduled_for ASC, s.created_at ASC`,
  ).all(today) as Row[];
  return rows.map(rowToSend);
}

export function claim(id: string): boolean {
  runMigrations();
  const res = getDb()
    .prepare("UPDATE house_account_sends SET status = 'sending', claimed_at = ? WHERE id = ? AND status = 'scheduled'")
    .run(new Date().toISOString(), id);
  return res.changes === 1;
}

export function markSent(id: string, r: { smsSid?: string; emailId?: string; body?: string; error?: string }): void {
  runMigrations();
  getDb().prepare(
    `UPDATE house_account_sends SET status = 'sent', sent_at = ?, sms_sid = ?, email_id = ?, body = ?, error = ? WHERE id = ?`,
  ).run(new Date().toISOString(), r.smsSid ?? null, r.emailId ?? null, r.body ?? null, r.error ?? null, id);
}

export function markFailed(id: string, error: string): void {
  runMigrations();
  getDb().prepare("UPDATE house_account_sends SET status = 'failed', error = ? WHERE id = ?").run(error, id);
}

export function markSkipped(id: string, reason: string): void {
  runMigrations();
  getDb().prepare("UPDATE house_account_sends SET status = 'skipped', error = ? WHERE id = ?").run(reason, id);
}

export function rescheduleSend(id: string, scheduledFor: string): ScheduledSend | null {
  runMigrations();
  const res = getDb()
    .prepare("UPDATE house_account_sends SET scheduled_for = ? WHERE id = ? AND status = 'scheduled'")
    .run(scheduledFor, id);
  return res.changes === 1 ? getSend(id) : null;
}

export function cancelForStatement(statementId: string): number {
  runMigrations();
  return getDb()
    .prepare("UPDATE house_account_sends SET status = 'canceled' WHERE statement_id = ? AND status = 'scheduled'")
    .run(statementId).changes;
}

/** On reactivation after a pause: anything that should have gone out meanwhile is skipped, not burst. */
export function skipStaleForAccount(accountId: string, today: string): number {
  runMigrations();
  return getDb()
    .prepare("UPDATE house_account_sends SET status = 'skipped', error = 'pausa' WHERE account_id = ? AND status = 'scheduled' AND scheduled_for < ?")
    .run(accountId, today).changes;
}

/** A crash mid-send leaves a row in 'sending'; the next cron turns old ones into failures. */
export function failStaleSending(cutoffIso: string): number {
  runMigrations();
  return getDb()
    .prepare("UPDATE house_account_sends SET status = 'failed', error = 'interrumpido' WHERE status = 'sending' AND claimed_at < ?")
    .run(cutoffIso).changes;
}

export type UpcomingSend = ScheduledSend & { accountName: string; statementNumber: string; dueDate: string };

export function upcomingSends(days: number, today: string): UpcomingSend[] {
  runMigrations();
  const until = addDaysStr(today, days);
  const rows = getDb().prepare(
    `SELECT s.*, a.name AS account_name, st.number AS statement_number, st.due_date AS due_date
       FROM house_account_sends s
       JOIN house_accounts a ON a.id = s.account_id
       JOIN house_account_statements st ON st.id = s.statement_id
     WHERE s.status = 'scheduled' AND s.scheduled_for <= ?
     ORDER BY s.scheduled_for ASC, a.name ASC`,
  ).all(until) as (Row & { account_name: string; statement_number: string; due_date: string })[];
  return rows.map((r) => ({ ...rowToSend(r), accountName: r.account_name, statementNumber: r.statement_number, dueDate: r.due_date }));
}

export function listForAccount(accountId: string): ScheduledSend[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM house_account_sends WHERE account_id = ? ORDER BY scheduled_for DESC, created_at DESC")
    .all(accountId) as Row[];
  return rows.map(rowToSend);
}
