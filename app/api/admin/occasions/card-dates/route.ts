import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { routeFailed } from "@/lib/card-dates-route";
import { listCardReviews, previewCardScan, scanPendingCardDates } from "@/lib/card-dates-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** What the history scan would do, and the orders waiting for a staff decision. */
export async function GET(req: Request): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ preview: previewCardScan(), reviews: listCardReviews() }, { headers: NO_STORE });
  } catch (e) {
    return routeFailed(e);
  }
}

/** Reads the card messages not read yet. Sends nothing; a second run finds nothing. */
export async function POST(req: Request): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const report = scanPendingCardDates();
    console.log(JSON.stringify({ event: "card_dates_run", ...report }));
    return NextResponse.json({ report, preview: previewCardScan(), reviews: listCardReviews() }, { headers: NO_STORE });
  } catch (e) {
    return routeFailed(e);
  }
}
