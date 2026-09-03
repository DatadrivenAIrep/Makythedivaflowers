import { NextResponse } from "next/server";
import { dueReminders, markReminderSent, renderReminder } from "@/lib/date-reminders";
import { sendSms } from "@/lib/twilio-server";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";

export const runtime = "nodejs";
// Never cached: the answer depends on today's date and on what has been sent.
export const dynamic = "force-dynamic";

/** How many days before the date the reminder goes out. */
const LEAD_DAYS = 7;

/**
 * Sends the "your mother's birthday is in a week" texts.
 *
 * Driven by an external cron (see docs/ops/date-reminders.md) rather than a
 * timer inside the app, because this deploys to a single Node process that
 * restarts on every deploy — a setInterval would silently stop running and
 * nobody would notice until a customer mentioned it.
 *
 * Safe to call more than once a day: `dueReminders` excludes anything already
 * recorded for that occurrence, and each send is recorded immediately.
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

  const due = dueReminders({ leadDays: LEAD_DAYS });
  const dry = twilioDryRun() || !twilioSmsEnabled();

  let sent = 0;
  let failed = 0;
  for (const r of due) {
    const body = renderReminder(r, r.locale);
    try {
      if (!dry) await sendSms(r.phone, body);
      // Recorded even in a dry run: a dry run that leaves everything "due"
      // would text the whole list the moment SMS is switched on.
      markReminderSent(r.dateId, r.occurrenceDate);
      sent += 1;
    } catch (e) {
      // One bad number must not stop the rest of the batch.
      failed += 1;
      console.error("[reminders] send failed", r.customerId, e);
    }
  }

  console.log(JSON.stringify({ event: "date_reminders_run", due: due.length, sent, failed, dry }));
  return NextResponse.json({ due: due.length, sent, failed, dryRun: dry });
}
