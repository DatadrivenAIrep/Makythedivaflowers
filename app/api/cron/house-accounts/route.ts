import { NextResponse } from "next/server";
import { shopDateStr, addDaysStr } from "@/lib/tv-slots";
import { accountsDueToIssue, issueStatement } from "@/lib/house-account-statements";
import { dueSends, failStaleSending } from "@/lib/house-account-sends";
import { dispatchSend } from "@/lib/house-account-sender";

export const runtime = "nodejs";
// Never cached: depends on today's date and on what has already gone out.
export const dynamic = "force-dynamic";

const STALE_SENDING_MS = 60 * 60 * 1000;

/**
 * Daily house-account job (see docs/ops/house-accounts.md): closes the period
 * for every account whose issue day is today, then sends every queued
 * statement / reminder that is due. Driven by an external cron, like
 * /api/cron/reminders. Safe to run more than once a day: issuing is unique
 * per period and every send row is claimed before it goes out.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[house-accounts] CRON_SECRET is not set; refusing to run");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = shopDateStr(new Date());
  failStaleSending(new Date(Date.now() - STALE_SENDING_MS).toISOString());

  let issued = 0;
  for (const account of accountsDueToIssue(today)) {
    try {
      if (issueStatement(account.id, addDaysStr(today, -1), { today })) issued += 1;
    } catch (e) {
      console.error("[house-accounts] issue failed", account.id, e);
    }
  }

  let sent = 0, skipped = 0, failed = 0;
  for (const row of dueSends(today)) {
    const done = await dispatchSend(row, today);
    if (done.status === "sent") sent += 1;
    else if (done.status === "skipped") skipped += 1;
    else if (done.status === "failed") failed += 1;
  }

  console.log(JSON.stringify({ event: "house_accounts_run", today, issued, sent, skipped, failed }));
  return NextResponse.json({ ok: true, today, issued, sent, skipped, failed });
}
