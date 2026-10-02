import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getCustomerById, getByPhoneUS, normalizePhone, type Customer } from "@/lib/customer-storage";
import { getSetting } from "@/lib/settings-storage";
import { shopDateStr } from "@/lib/tv-slots";
import {
  resolveDefaults, parseReminderPlan, anchorFor, nextIssueDate, SETTING_HOUSE_ACCOUNT_DEFAULTS,
} from "@/lib/house-account-plan";
import type {
  HouseAccount, AccountStatus, AccountCadence, SendChannel, ReminderStep,
} from "@/types/house-account";

type Row = {
  id: string; name: string; billing_name: string | null; billing_phone: string | null;
  billing_email: string | null; locale: string; cadence: string; issue_day: number;
  anchor_date: string | null; terms_days: number; reminder_plan_json: string;
  statement_channel: string; status: string; notes: string | null; created_at: string; updated_at: string;
};

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function rowToAccount(r: Row): HouseAccount {
  return {
    id: r.id,
    name: r.name,
    billingName: r.billing_name ?? undefined,
    billingPhone: r.billing_phone ?? undefined,
    billingEmail: r.billing_email ?? undefined,
    locale: r.locale === "es" ? "es" : "en",
    cadence: r.cadence as AccountCadence,
    issueDay: r.issue_day,
    anchorDate: r.anchor_date ?? undefined,
    termsDays: r.terms_days,
    reminderPlan: parseReminderPlan(r.reminder_plan_json),
    statementChannel: r.statement_channel as SendChannel,
    status: r.status as AccountStatus,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type CreateAccountInput = {
  name: string;
  billingName?: string;
  billingPhone?: string;
  billingEmail?: string;
  locale?: "en" | "es";
  cadence?: AccountCadence;
  issueDay?: number;
  termsDays?: number;
  reminderPlan?: ReminderStep[];
  statementChannel?: SendChannel;
  notes?: string;
};

function assertIssueDay(cadence: AccountCadence, issueDay: number): void {
  const ok = cadence === "monthly" ? issueDay >= 1 && issueDay <= 28 : issueDay >= 0 && issueDay <= 6;
  if (!Number.isInteger(issueDay) || !ok) throw new Error("issue_day_invalid");
}

function cleanPhone(p: string | undefined): string | null {
  if (!p) return null;
  const d = normalizePhone(p);
  return d.length ? d : null;
}
function cleanText(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

export function createAccount(input: CreateAccountInput, today: string = shopDateStr(new Date())): HouseAccount {
  runMigrations();
  const name = input.name?.trim();
  if (!name) throw new Error("name_required");
  const defaults = resolveDefaults(getSetting(SETTING_HOUSE_ACCOUNT_DEFAULTS));
  const cadence = input.cadence ?? defaults.cadence;
  // A cadence that differs from the defaults' cadence gets a neutral issue day (1 = Monday or the 1st).
  const issueDay = input.issueDay ?? (cadence === defaults.cadence ? defaults.issueDay : 1);
  assertIssueDay(cadence, issueDay);
  const termsDays = input.termsDays ?? defaults.termsDays;
  if (!Number.isInteger(termsDays) || termsDays < 0) throw new Error("terms_invalid");
  const plan = input.reminderPlan ?? defaults.reminderPlan;
  const anchor = cadence === "biweekly" ? anchorFor(issueDay, today) : null;
  const id = newId("ha");
  const now = new Date().toISOString();
  getDb().prepare(
    `INSERT INTO house_accounts (id, name, billing_name, billing_phone, billing_email, locale, cadence, issue_day,
       anchor_date, terms_days, reminder_plan_json, statement_channel, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
  ).run(
    id, name, cleanText(input.billingName), cleanPhone(input.billingPhone), cleanText(input.billingEmail),
    input.locale ?? "en", cadence, issueDay, anchor, termsDays, JSON.stringify(plan),
    input.statementChannel ?? defaults.statementChannel, cleanText(input.notes), now, now,
  );
  return getAccount(id)!;
}

export function getAccount(id: string): HouseAccount | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM house_accounts WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToAccount(row) : null;
}

export type AccountPatch = Partial<CreateAccountInput> & { status?: AccountStatus };

export function updateAccount(id: string, patch: AccountPatch, today: string = shopDateStr(new Date())): HouseAccount | null {
  const cur = getAccount(id);
  if (!cur) return null;
  const cadence = patch.cadence ?? cur.cadence;
  // Changing cadence without an explicit day resets it (1 = Monday or the 1st) so a weekday never leaks into a monthly plan.
  const issueDay = patch.issueDay ?? (patch.cadence && patch.cadence !== cur.cadence ? 1 : cur.issueDay);
  assertIssueDay(cadence, issueDay);
  const termsDays = patch.termsDays ?? cur.termsDays;
  if (!Number.isInteger(termsDays) || termsDays < 0) throw new Error("terms_invalid");
  const name = patch.name !== undefined ? patch.name.trim() : cur.name;
  if (!name) throw new Error("name_required");
  const cadenceOrDayChanged = cadence !== cur.cadence || issueDay !== cur.issueDay;
  const anchor = cadence === "biweekly"
    ? (cadenceOrDayChanged || !cur.anchorDate ? anchorFor(issueDay, today) : cur.anchorDate)
    : null;
  const now = new Date().toISOString();
  getDb().prepare(
    `UPDATE house_accounts SET name = ?, billing_name = ?, billing_phone = ?, billing_email = ?, locale = ?,
       cadence = ?, issue_day = ?, anchor_date = ?, terms_days = ?, reminder_plan_json = ?, statement_channel = ?,
       status = ?, notes = ?, updated_at = ? WHERE id = ?`,
  ).run(
    name,
    patch.billingName !== undefined ? cleanText(patch.billingName) : (cur.billingName ?? null),
    patch.billingPhone !== undefined ? cleanPhone(patch.billingPhone) : (cur.billingPhone ?? null),
    patch.billingEmail !== undefined ? cleanText(patch.billingEmail) : (cur.billingEmail ?? null),
    patch.locale ?? cur.locale,
    cadence, issueDay, anchor, termsDays,
    JSON.stringify(patch.reminderPlan ?? cur.reminderPlan),
    patch.statementChannel ?? cur.statementChannel,
    patch.status ?? cur.status,
    patch.notes !== undefined ? cleanText(patch.notes) : (cur.notes ?? null),
    now, id,
  );
  return getAccount(id);
}

export function accountBalanceCents(id: string): number {
  runMigrations();
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS b FROM house_account_entries WHERE account_id = ?")
    .get(id) as { b: number };
  return row.b;
}

// ---- contacts ----

export function linkContact(accountId: string, customerId: string): void {
  runMigrations();
  if (!getCustomerById(customerId)) throw new Error("customer_not_found");
  const db = getDb();
  const existing = db.prepare("SELECT account_id FROM house_account_contacts WHERE customer_id = ?").get(customerId) as
    | { account_id: string } | undefined;
  if (existing) {
    if (existing.account_id === accountId) return;
    throw new Error("contact_taken");
  }
  db.prepare("INSERT INTO house_account_contacts (account_id, customer_id, created_at) VALUES (?, ?, ?)")
    .run(accountId, customerId, new Date().toISOString());
}

export function unlinkContact(accountId: string, customerId: string): void {
  runMigrations();
  getDb().prepare("DELETE FROM house_account_contacts WHERE account_id = ? AND customer_id = ?").run(accountId, customerId);
}

export function listContacts(accountId: string): Customer[] {
  runMigrations();
  const ids = getDb()
    .prepare("SELECT customer_id FROM house_account_contacts WHERE account_id = ? ORDER BY created_at ASC")
    .all(accountId) as { customer_id: string }[];
  return ids.map((r) => getCustomerById(r.customer_id)).filter((c): c is Customer => c !== null);
}

export function findAccountForCustomer(customerId: string): HouseAccount | null {
  runMigrations();
  const row = getDb()
    .prepare("SELECT a.* FROM house_account_contacts c JOIN house_accounts a ON a.id = c.account_id WHERE c.customer_id = ?")
    .get(customerId) as Row | undefined;
  return row ? rowToAccount(row) : null;
}

export function findAccountForPhone(phone: string): HouseAccount | null {
  const customer = getByPhoneUS(phone);
  return customer ? findAccountForCustomer(customer.id) : null;
}

// ---- lists ----

export function searchAccounts(q: string, limit = 8): { id: string; name: string }[] {
  runMigrations();
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return getDb()
    .prepare("SELECT id, name FROM house_accounts WHERE status = 'active' AND LOWER(name) LIKE ? ORDER BY name LIMIT ?")
    .all(`%${needle}%`, limit) as { id: string; name: string }[];
}

export type AccountFilter = "all" | "with_balance" | "overdue" | "paused";
export type AccountListItem = HouseAccount & {
  balanceCents: number;
  oldestOpen: { id: string; number: string; dueDate: string; dueCents: number } | null;
  overdue: boolean;
  lastPaymentAt: string | null;
  nextIssueDate: string;
};

export function listAccounts(opts: { q?: string; filter?: AccountFilter; today?: string } = {}): AccountListItem[] {
  runMigrations();
  const db = getDb();
  const today = opts.today ?? shopDateStr(new Date());
  const rows = db.prepare("SELECT * FROM house_accounts ORDER BY name").all() as Row[];
  const oldestStmt = db.prepare(
    `SELECT id, number, due_date, closing_cents, settled_cents FROM house_account_statements
     WHERE account_id = ? AND status = 'open' ORDER BY due_date ASC, created_at ASC LIMIT 1`,
  );
  const lastPay = db.prepare(
    "SELECT created_at FROM house_account_entries WHERE account_id = ? AND kind = 'payment' ORDER BY created_at DESC LIMIT 1",
  );
  const needle = opts.q?.trim().toLowerCase();
  const items: AccountListItem[] = [];
  for (const r of rows) {
    const a = rowToAccount(r);
    if (needle && !a.name.toLowerCase().includes(needle)) continue;
    const balanceCents = accountBalanceCents(a.id);
    const s = oldestStmt.get(a.id) as
      | { id: string; number: string; due_date: string; closing_cents: number; settled_cents: number } | undefined;
    const oldestOpen = s
      ? { id: s.id, number: s.number, dueDate: s.due_date, dueCents: Math.max(0, s.closing_cents - s.settled_cents) }
      : null;
    const overdue = !!oldestOpen && oldestOpen.dueCents > 0 && oldestOpen.dueDate < today;
    const lp = lastPay.get(a.id) as { created_at: string } | undefined;
    items.push({
      ...a, balanceCents, oldestOpen, overdue,
      lastPaymentAt: lp?.created_at ?? null,
      nextIssueDate: nextIssueDate(a, today),
    });
  }
  const filtered = items.filter((x) => {
    switch (opts.filter ?? "all") {
      case "with_balance": return x.balanceCents > 0;
      case "overdue": return x.overdue;
      case "paused": return x.status === "paused";
      default: return true;
    }
  });
  // Overdue first, then the biggest balances, then by name.
  return filtered.sort((x, y) =>
    Number(y.overdue) - Number(x.overdue) || y.balanceCents - x.balanceCents || x.name.localeCompare(y.name));
}

export function receivablesSummary(today: string = shopDateStr(new Date())): {
  balanceCents: number; overdueCents: number; overdueCount: number;
} {
  runMigrations();
  const db = getDb();
  const balances = db
    .prepare("SELECT account_id, SUM(amount_cents) AS b FROM house_account_entries GROUP BY account_id")
    .all() as { account_id: string; b: number }[];
  const balanceCents = balances.reduce((s, r) => s + Math.max(0, r.b), 0);
  const overdue = db
    .prepare(
      `SELECT account_id, closing_cents, settled_cents FROM house_account_statements WHERE status = 'open' AND due_date < ?`,
    )
    .all(today) as { account_id: string; closing_cents: number; settled_cents: number }[];
  // Statements are cumulative (each closing includes the previous), so an
  // account's overdue amount is its largest overdue due, never their sum.
  const perAccount = new Map<string, number>();
  for (const s of overdue) {
    const due = Math.max(0, s.closing_cents - s.settled_cents);
    if (due > 0) perAccount.set(s.account_id, Math.max(perAccount.get(s.account_id) ?? 0, due));
  }
  let overdueCents = 0;
  for (const v of perAccount.values()) overdueCents += v;
  return { balanceCents, overdueCents, overdueCount: perAccount.size };
}
