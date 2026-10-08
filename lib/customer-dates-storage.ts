import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  nextOccurrence,
  PREFERENCE_KINDS,
  type DateKind,
  type NextOccurrence,
  type PreferenceKind,
} from "@/lib/customer-dates";

export type ImportantDate = {
  id: string;
  customerId: string;
  kind: DateKind;
  label?: string;
  month: number;
  day: number;
  year?: number;
  /** Last 10 digits of the recipient this date belongs to, when it came from an order. */
  recipientPhone?: string;
  createdAt: string;
  next: NextOccurrence;
};

export type PreferencesMap = Record<PreferenceKind, string[]>;

export type UpcomingOccasion = {
  dateId: string;
  customerId: string;
  customerName: string;
  phone: string;
  kind: DateKind;
  label?: string;
  next: NextOccurrence;
};

type DateRow = {
  id: string;
  customer_id: string;
  kind: string;
  label: string | null;
  month: number;
  day: number;
  year: number | null;
  recipient_phone: string | null;
  created_at: string;
};

function newId(): string {
  return `cid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rowToDate(r: DateRow, now: Date): ImportantDate {
  return {
    id: r.id,
    customerId: r.customer_id,
    kind: r.kind as DateKind,
    label: r.label ?? undefined,
    month: r.month,
    day: r.day,
    year: r.year ?? undefined,
    recipientPhone: r.recipient_phone ?? undefined,
    createdAt: r.created_at,
    next: nextOccurrence(r.month, r.day, now),
  };
}

export type ImportantDateInput = {
  kind: DateKind;
  label?: string;
  month: number;
  day: number;
  year?: number;
  recipientPhone?: string;
};

export function addImportantDate(
  customerId: string,
  input: ImportantDateInput,
  now: Date = new Date(),
): ImportantDate[] {
  runMigrations();
  getDb()
    .prepare(
      `INSERT INTO customer_important_dates (id, customer_id, kind, label, month, day, year, recipient_phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId(),
      customerId,
      input.kind,
      input.label?.trim() || null,
      input.month,
      input.day,
      input.year ?? null,
      input.recipientPhone || null,
      now.toISOString(),
    );
  return listDatesFor(customerId, now);
}

export function removeImportantDate(
  customerId: string,
  dateId: string,
  now: Date = new Date(),
): ImportantDate[] {
  runMigrations();
  getDb()
    .prepare("DELETE FROM customer_important_dates WHERE customer_id = ? AND id = ?")
    .run(customerId, dateId);
  return listDatesFor(customerId, now);
}

export function listDatesFor(customerId: string, now: Date = new Date()): ImportantDate[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM customer_important_dates WHERE customer_id = ?")
    .all(customerId) as DateRow[];
  return rows
    .map((r) => rowToDate(r, now))
    .sort((a, b) => a.next.daysUntil - b.next.daysUntil || a.id.localeCompare(b.id));
}

export const PREFERENCE_MAX_LENGTH = 40;

/** trim + collapse inner whitespace + lowercase + cap length; null when empty. */
export function normalizePreference(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, PREFERENCE_MAX_LENGTH).trim();
  return v.length ? v : null;
}

function emptyPreferences(): PreferencesMap {
  return { favorite_flower: [], favorite_color: [], dislike: [] };
}

export function listPreferencesFor(customerId: string): PreferencesMap {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT kind, value FROM customer_preferences WHERE customer_id = ? ORDER BY value")
    .all(customerId) as Array<{ kind: string; value: string }>;
  const map = emptyPreferences();
  for (const r of rows) {
    if ((PREFERENCE_KINDS as readonly string[]).includes(r.kind)) {
      map[r.kind as PreferenceKind].push(r.value);
    }
  }
  return map;
}

export function addPreference(
  customerId: string,
  kind: PreferenceKind,
  value: string,
): PreferencesMap {
  runMigrations();
  getDb()
    .prepare("INSERT OR IGNORE INTO customer_preferences (customer_id, kind, value) VALUES (?, ?, ?)")
    .run(customerId, kind, value);
  return listPreferencesFor(customerId);
}

export function removePreference(
  customerId: string,
  kind: PreferenceKind,
  value: string,
): PreferencesMap {
  runMigrations();
  getDb()
    .prepare("DELETE FROM customer_preferences WHERE customer_id = ? AND kind = ? AND value = ?")
    .run(customerId, kind, value);
  return listPreferencesFor(customerId);
}

export function listPreferenceValues(kind: PreferenceKind): string[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT DISTINCT value FROM customer_preferences WHERE kind = ? ORDER BY value")
    .all(kind) as Array<{ value: string }>;
  return rows.map((r) => r.value);
}

export function listUpcomingOccasions(
  withinDays: number,
  now: Date = new Date(),
): UpcomingOccasion[] {
  runMigrations();
  const rows = getDb()
    .prepare(
      `SELECT d.id AS date_id, d.customer_id, d.kind, d.label, d.month, d.day,
              c.name AS customer_name, c.phone
       FROM customer_important_dates d
       JOIN customers c ON c.id = d.customer_id`,
    )
    .all() as Array<{
    date_id: string;
    customer_id: string;
    kind: string;
    label: string | null;
    month: number;
    day: number;
    customer_name: string;
    phone: string;
  }>;
  return rows
    .map((r) => ({
      dateId: r.date_id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      phone: r.phone,
      kind: r.kind as DateKind,
      label: r.label ?? undefined,
      next: nextOccurrence(r.month, r.day, now),
    }))
    .filter((o) => o.next.daysUntil <= withinDays)
    .sort(
      (a, b) =>
        a.next.daysUntil - b.next.daysUntil || a.customerName.localeCompare(b.customerName),
    );
}

/** Suggestion keys (lib/date-suggestions) the shop turned down for this customer. */
export function listDismissedSuggestions(customerId: string): Set<string> {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT suggestion_key FROM date_suggestion_dismissals WHERE customer_id = ?")
    .all(customerId) as Array<{ suggestion_key: string }>;
  return new Set(rows.map((r) => r.suggestion_key));
}

export function dismissSuggestion(customerId: string, key: string, now: Date = new Date()): void {
  runMigrations();
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO date_suggestion_dismissals (customer_id, suggestion_key, created_at)
       VALUES (?, ?, ?)`,
    )
    .run(customerId, key, now.toISOString());
}

/**
 * Saves "every year on this day" for one of the customer's recipients, from the
 * delivery date of an order. Returns false (and saves nothing) when the customer
 * already has that kind of date for that recipient.
 */
export function rememberRecipientDate(
  customerId: string,
  input: { kind: "birthday" | "anniversary"; recipientName: string; recipientPhone?: string; ymd: string },
  now: Date = new Date(),
): boolean {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(input.ymd);
  const name = input.recipientName.trim();
  if (!m || !name) return false;
  const phone = (input.recipientPhone ?? "").replace(/\D/g, "").slice(-10);
  const already = listDatesFor(customerId, now).some(
    (d) =>
      d.kind === input.kind &&
      ((phone.length === 10 && d.recipientPhone === phone) || (d.label ?? "").trim().toLowerCase() === name.toLowerCase()),
  );
  if (already) return false;
  addImportantDate(
    customerId,
    { kind: input.kind, label: name, month: Number(m[1]), day: Number(m[2]), recipientPhone: phone.length === 10 ? phone : undefined },
    now,
  );
  return true;
}
