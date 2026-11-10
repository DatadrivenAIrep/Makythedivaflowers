import { NextResponse } from "next/server";
import { runDuePending } from "@/lib/loyalty-sync";
import { runDueBonuses } from "@/lib/loyalty-bonus";
import { dateRewardsEnabled } from "@/lib/date-rewards-flags";

export const runtime = "nodejs";
// Never cached: the answer depends on what is pending right now.
export const dynamic = "force-dynamic";

/**
 * Retries the loyalty-card steps (stamps and reversals) that did not go through
 * the first time. Driven by the same external cron as the reminders (see
 * docs/ops/loyalty-card.md), every 10 minutes. Every step is safe to repeat
 * because each one carries the same loyalty order id.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[loyalty-sync] CRON_SECRET is not set; refusing to run");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const counts = await runDuePending();
  if (!dateRewardsEnabled()) {
    console.log(JSON.stringify({ event: "loyalty_sync_run", ...counts }));
    return NextResponse.json(counts);
  }
  const bonus = await runDueBonuses();
  console.log(JSON.stringify({ event: "loyalty_sync_run", ...counts, bonus }));
  return NextResponse.json({ ...counts, bonus });
}
