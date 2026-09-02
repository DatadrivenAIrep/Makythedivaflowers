import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { nextOccurrence, type DateKind } from "@/lib/customer-dates";
import { OPT_OUT_FOOTER } from "@/lib/campaign-sender";

/**
 * "Your mother's birthday is in a week" — the retention loop QG Floral runs and
 * the one piece of their programme worth copying outright. The dates already
 * exist in the CRM; this turns them into a message.
 *
 * Two rules make it safe to run from an external cron that may fire more than
 * once: the customer must have opted in to marketing texts, and a reminder is
 * recorded per occurrence so the same birthday is never sent twice.
 */

export type DueReminder = {
  dateId: string;
  customerId: string;
  customerName: string;
  phone: string;
  locale: "en" | "es";
  kind: DateKind;
  label?: string;
  /** YYYY-MM-DD of the occurrence this reminder is about. */
  occurrenceDate: string;
  daysUntil: number;
};

export function dueReminders({
  leadDays,
  now = new Date(),
}: {
  leadDays: number;
  now?: Date;
}): DueReminder[] {
  runMigrations();
  const rows = getDb()
    .prepare(
      `SELECT d.id AS date_id, d.customer_id, d.kind, d.label, d.month, d.day,
              c.name AS customer_name, c.phone, c.locale
         FROM customer_important_dates d
         JOIN customers c ON c.id = d.customer_id
        WHERE (c.messaging_channel IS NULL OR c.messaging_channel <> 'none')
          AND EXISTS (
                SELECT 1 FROM customer_tags t
                 WHERE t.customer_id = c.id AND t.tag = 'sms-marketing'
              )`,
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
    locale: string | null;
  }>;

  const alreadySent = getDb().prepare(
    "SELECT 1 FROM date_reminder_sends WHERE date_id = ? AND occurrence_date = ? LIMIT 1",
  );

  return rows
    .map((r) => {
      const next = nextOccurrence(r.month, r.day, now);
      return { r, next };
    })
    .filter(({ next }) => next.daysUntil === leadDays)
    .filter(({ r, next }) => !alreadySent.get(r.date_id, next.date))
    .map(({ r, next }) => ({
      dateId: r.date_id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      phone: r.phone,
      locale: r.locale === "en" ? ("en" as const) : ("es" as const),
      kind: r.kind as DateKind,
      label: r.label ?? undefined,
      occurrenceDate: next.date,
      daysUntil: next.daysUntil,
    }));
}

export function markReminderSent(dateId: string, occurrenceDate: string): void {
  runMigrations();
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO date_reminder_sends (date_id, occurrence_date, sent_at)
       VALUES (?, ?, ?)`,
    )
    .run(dateId, occurrenceDate, new Date().toISOString());
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "";
}

const OCCASION_WORD: Record<DateKind, { en: string; es: string }> = {
  birthday: { en: "birthday", es: "cumpleaños" },
  anniversary: { en: "anniversary", es: "aniversario" },
  custom: { en: "date", es: "fecha" },
};

/**
 * The message. Deliberately short and specific: it names the occasion, says when,
 * and stops. A reminder that reads like an advert gets a STOP reply.
 */
export function renderReminder(
  r: Pick<DueReminder, "customerName" | "kind" | "label" | "occurrenceDate">,
  locale: "en" | "es",
): string {
  const name = firstName(r.customerName);
  const what = r.kind === "custom" && r.label ? r.label : OCCASION_WORD[r.kind][locale];
  const when = new Date(r.occurrenceDate + "T00:00:00Z").toLocaleDateString(
    locale === "es" ? "es-ES" : "en-US",
    { month: "long", day: "numeric", timeZone: "UTC" },
  );

  const body =
    locale === "es"
      ? `${name ? `Hola ${name}, ` : ""}se acerca ${r.kind === "custom" && r.label ? r.label : `un ${what}`} el ${when}. ¿Te lo preparamos? Responde y lo dejamos listo. — Diva Flowers`
      : `${name ? `Hi ${name}, ` : ""}a ${what} is coming up on ${when}. Want us to have something ready? Reply and we will. — Diva Flowers`;

  return `${body.replace(/\s{2,}/g, " ").trim()} ${OPT_OUT_FOOTER[locale]}`;
}
