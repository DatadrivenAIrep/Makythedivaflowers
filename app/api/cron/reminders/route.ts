import { NextResponse } from "next/server";
import {
  dueReminders,
  hasOrderForWindow,
  hasRecentPaidOrder,
  recordReminder,
  renderReminder,
  type DueReminder,
  type ReminderStage,
} from "@/lib/date-reminders";
import { renderSaleReminder } from "@/lib/date-sale-message";
import { getDatePreferences } from "@/lib/date-preferences-storage";
import { dateRewardsEnabled, d3RemindersEnabled } from "@/lib/date-rewards-flags";
import { lookupCustomer, loyaltyEnabled } from "@/lib/loyalty-client";
import { applicableRewards } from "@/lib/loyalty-rewards";
import { removeTag, updateCustomer } from "@/lib/customer-storage";
import { markSmsStopped } from "@/lib/promo-consent";
import { sendSms, e164 } from "@/lib/twilio-server";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";

export const runtime = "nodejs";
// Never cached: the answer depends on today's date and on what has been sent.
export const dynamic = "force-dynamic";

/** How many days before the date each reminder goes out. */
const LEAD_DAYS: Record<ReminderStage, number> = { d7: 7, d3: 3 };

function isCode21610(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: number }).code === 21610;
}

/**
 * What a failure log may carry: the error code (Twilio's numeric one, or a string
 * code) or else the error's class name. Never the message: Twilio puts the
 * destination number in it ("The 'To' number +1516... is not a valid phone number").
 */
function errorTag(e: unknown): string {
  const code = typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  if (typeof code === "number" || (typeof code === "string" && code !== "")) return String(code);
  return e instanceof Error ? e.name : typeof e;
}

/** Best card discount for this customer, or null on any failure, a disabled card or no reward. */
async function bestRewardPercent(phone: string): Promise<number | null> {
  if (!loyaltyEnabled()) return null;
  try {
    const card = await lookupCustomer(e164(phone), { timeoutMs: 5000 });
    if (!card) return null;
    const percents = applicableRewards(card.rewards.available).map((r) => r.percent);
    return percents.length ? Math.max(...percents) : null;
  } catch (e) {
    // Fall back to no discount sentence, but leave a trace: a bad key or an
    // outage would otherwise quietly strip it from every text. Log the code or
    // name only, never the phone or the message (messages can carry phones).
    const code = (e as { code?: unknown })?.code;
    console.warn("[reminders] card lookup failed", typeof code === "string" ? code : (e as Error)?.name ?? "unknown");
    return null;
  }
}

/**
 * Sends the "your mother's birthday is coming" texts: the 3-day sales text first
 * (when switched on), then the 7-day reminder.
 *
 * Driven by an external cron (see docs/ops/date-reminders.md) rather than a
 * timer inside the app, because this deploys to a single Node process that
 * restarts on every deploy — a setInterval would silently stop running and
 * nobody would notice until a customer mentioned it.
 *
 * Safe to call more than once a day: `dueReminders` excludes anything already
 * recorded for that occurrence and stage, and each result is recorded immediately.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[reminders] CRON_SECRET is not set; refusing to run");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Same UTC calendar day nextOccurrence counts from.
  const today = now.toISOString().slice(0, 10);
  const dry = twilioDryRun() || !twilioSmsEnabled();
  const d3On = d3RemindersEnabled();
  // One date text per customer per run, but only once the new features are on:
  // with both flags off the loop behaves exactly as it always has.
  const capOn = d3On || dateRewardsEnabled();
  const written = new Set<string>();

  let total = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  async function send(r: DueReminder, stage: ReminderStage, body: string) {
    try {
      try {
        if (!dry) await sendSms(r.phone, body);
        // Counted against the daily cap the moment the text is out, before the
        // ledger write: if that write fails, a second date text must still not
        // go to the same customer in this run.
        written.add(r.customerId);
        // Recorded even in a dry run: a dry run that leaves everything "due"
        // would text the whole list the moment SMS is switched on.
        recordReminder(r.dateId, r.occurrenceDate, stage, "sent");
        sent += 1;
      } catch (e) {
        if (!isCode21610(e)) throw e;
        updateCustomer(r.customerId, { messagingChannel: "none" });
        removeTag(r.customerId, "sms-marketing");
        markSmsStopped(r.customerId);
        recordReminder(r.dateId, r.occurrenceDate, stage, "skipped", "21610");
        skipped += 1;
      }
    } catch (e) {
      // One bad number (or a failed write) must not stop the rest of the batch;
      // it stays due for the next run.
      failed += 1;
      console.error("[reminders] send failed", r.customerId, errorTag(e));
    }
  }

  if (d3On) {
    // Nothing in the 3-day phase may keep the 7-day reminders from going out:
    // they are due on one day only and would never be retried.
    try {
      const due = dueReminders({ leadDays: LEAD_DAYS.d3, stage: "d3", now });
      total += due.length;
      for (const r of due) {
        try {
          if (r.kind === "custom") continue; // dueReminders already excludes these
          if (hasRecentPaidOrder(r.customerId, now)) {
            recordReminder(r.dateId, r.occurrenceDate, "d3", "skipped", "recent_order");
            skipped += 1;
            continue;
          }
          // Already has flowers on the way for this date (ordered more than a week ago).
          if (hasOrderForWindow(r.customerId, today, r.occurrenceDate)) {
            recordReminder(r.dateId, r.occurrenceDate, "d3", "skipped", "already_ordered");
            skipped += 1;
            continue;
          }
          if (written.has(r.customerId)) {
            recordReminder(r.dateId, r.occurrenceDate, "d3", "skipped", "daily_cap");
            skipped += 1;
            continue;
          }
          const rewardPercent = await bestRewardPercent(r.phone);
          const body = renderSaleReminder({
            customerName: r.customerName,
            kind: r.kind,
            label: r.label,
            source: r.source,
            locale: r.locale,
            prefs: getDatePreferences(r.dateId),
            rewardPercent,
          });
          await send(r, "d3", body);
        } catch (e) {
          failed += 1;
          console.error("[reminders] d3 failed", r.customerId, errorTag(e));
        }
      }
    } catch (e) {
      console.error("[reminders] d3 phase failed", errorTag(e));
    }
  }

  const due7 = dueReminders({ leadDays: LEAD_DAYS.d7, stage: "d7", now });
  total += due7.length;
  for (const r of due7) {
    try {
      if (capOn && written.has(r.customerId)) {
        recordReminder(r.dateId, r.occurrenceDate, "d7", "skipped", "daily_cap");
        skipped += 1;
        continue;
      }
      await send(r, "d7", renderReminder(r, r.locale));
    } catch (e) {
      failed += 1;
      console.error("[reminders] d7 failed", r.customerId, errorTag(e));
    }
  }

  console.log(JSON.stringify({ event: "date_reminders_run", due: total, sent, failed, skipped, dry }));
  return NextResponse.json({ due: total, sent, failed, skipped, dryRun: dry });
}
