import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { nextOccurrence, type DateKind } from "@/lib/customer-dates";
import { dateRewardsEnabled } from "@/lib/date-rewards-flags";
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
  /** Who saved the date: the customer, or the shop (also every date from before 042). */
  source: "admin" | "customer";
  /** YYYY-MM-DD of the occurrence this reminder is about. */
  occurrenceDate: string;
  daysUntil: number;
};

export type ReminderStage = "d7" | "d3";
export type SkipReason = "recent_order" | "already_ordered" | "daily_cap" | "21610";

export function dueReminders({
  leadDays,
  stage = "d7",
  now = new Date(),
}: {
  leadDays: number;
  stage?: ReminderStage;
  now?: Date;
}): DueReminder[] {
  runMigrations();
  // With the feature on, the sms-marketing tag alone decides (promo permission is
  // independent of messaging_channel); with it off, behaviour is unchanged.
  const channelCondition = dateRewardsEnabled()
    ? ""
    : "(c.messaging_channel IS NULL OR c.messaging_channel <> 'none') AND";
  // Once the feature is on, a number that already replied STOP is left alone.
  const stoppedCondition = dateRewardsEnabled() ? "c.sms_stopped_at IS NULL AND" : "";
  // The 3-day sales text is for birthdays and anniversaries only.
  const kindCondition = stage === "d3" ? "d.kind IN ('birthday', 'anniversary') AND" : "";
  const rows = getDb()
    .prepare(
      `SELECT d.id AS date_id, d.customer_id, d.kind, d.label, d.month, d.day, d.source,
              c.name AS customer_name, c.phone, c.locale
         FROM customer_important_dates d
         JOIN customers c ON c.id = d.customer_id
        WHERE d.source <> 'card' AND
          ${channelCondition}
          ${stoppedCondition}
          ${kindCondition}
          EXISTS (
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
    source: string | null;
    customer_name: string;
    phone: string;
    locale: string | null;
  }>;

  const alreadySent = getDb().prepare(
    "SELECT 1 FROM date_reminder_sends WHERE date_id = ? AND occurrence_date = ? AND stage = ? LIMIT 1",
  );

  return rows
    .map((r) => {
      const next = nextOccurrence(r.month, r.day, now);
      return { r, next };
    })
    .filter(({ next }) => next.daysUntil === leadDays)
    .filter(({ r, next }) => !alreadySent.get(r.date_id, next.date, stage))
    .map(({ r, next }) => ({
      dateId: r.date_id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      phone: r.phone,
      locale: r.locale === "en" ? ("en" as const) : ("es" as const),
      kind: r.kind as DateKind,
      label: r.label ?? undefined,
      source: r.source === "customer" ? ("customer" as const) : ("admin" as const),
      occurrenceDate: next.date,
      daysUntil: next.daysUntil,
    }));
}

/** Records a send or a skip for one stage of one occurrence; recording twice is harmless. */
export function recordReminder(
  dateId: string,
  occurrenceDate: string,
  stage: ReminderStage,
  status: "sent" | "skipped",
  skipReason?: SkipReason,
): void {
  runMigrations();
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO date_reminder_sends (date_id, occurrence_date, stage, status, skip_reason, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(dateId, occurrenceDate, stage, status, skipReason ?? null, new Date().toISOString());
}

export function markReminderSent(dateId: string, occurrenceDate: string): void {
  recordReminder(dateId, occurrenceDate, "d7", "sent");
}

/**
 * A paid, non-canceled order already set for delivery or pickup between today and the
 * occurrence (both inclusive, YYYY-MM-DD): the customer has flowers for that date, so
 * a sales text would be selling them what they already bought.
 */
export function hasOrderForWindow(customerId: string, today: string, occurrenceDate: string): boolean {
  runMigrations();
  return Boolean(
    getDb()
      .prepare(
        `SELECT 1 FROM orders
          WHERE customer_id = ? AND payment_status = 'paid'
            AND fulfillment_status != 'canceled'
            AND window_date IS NOT NULL AND window_date >= ? AND window_date <= ?
          LIMIT 1`,
      )
      .get(customerId, today, occurrenceDate),
  );
}

/** A paid, non-canceled order in the last `days` days: no sales text on top of a fresh purchase. */
export function hasRecentPaidOrder(customerId: string, now: Date, days = 7): boolean {
  runMigrations();
  const since = new Date(now.getTime() - days * 86400_000).toISOString();
  return Boolean(
    getDb()
      .prepare(
        `SELECT 1 FROM orders
          WHERE customer_id = ? AND payment_status = 'paid'
            AND fulfillment_status != 'canceled' AND created_at >= ?
          LIMIT 1`,
      )
      .get(customerId, since),
  );
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
  // A birthday or anniversary saved for someone ("Mamá Rosa") names them.
  const whose = r.kind !== "custom" && r.label?.trim() ? r.label.trim() : "";
  const when = new Date(r.occurrenceDate + "T00:00:00Z").toLocaleDateString(
    locale === "es" ? "es-ES" : "en-US",
    { month: "long", day: "numeric", timeZone: "UTC" },
  );

  const body =
    locale === "es"
      ? `${name ? `Hola ${name}, ` : ""}se acerca ${whose ? `el ${what} de ${whose}` : r.kind === "custom" && r.label ? r.label : `un ${what}`} el ${when}. ¿Te lo preparamos? Responde y lo dejamos listo. — Diva Flowers`
      : `${name ? `Hi ${name}, ` : ""}${whose ? `${whose}'s ${what}` : `a ${what}`} is coming up on ${when}. Want us to have something ready? Reply and we will. — Diva Flowers`;

  return `${body.replace(/\s{2,}/g, " ").trim()} ${OPT_OUT_FOOTER[locale]}`;
}
