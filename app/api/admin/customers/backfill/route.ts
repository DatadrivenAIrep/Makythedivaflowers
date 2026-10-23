import { NextResponse } from "next/server";
import { previewBackfill, runBackfill } from "@/lib/backfill-customers";

// Admin-only: every /api/admin/* route is gated by proxy.ts.
// Sends nothing — see lib/backfill-customers.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many paid orders are still unlinked, and what linking them would do. */
export async function GET(): Promise<Response> {
  try {
    return NextResponse.json(previewBackfill(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(JSON.stringify({ event: "customers_backfill_preview_failed", error: String(e) }));
    return NextResponse.json({ error: "preview_failed" }, { status: 500 });
  }
}

/** Links them. Idempotent: a second call finds nothing pending. */
export async function POST(): Promise<Response> {
  try {
    const report = runBackfill();
    const { pendingOrders } = previewBackfill();
    console.log(
      JSON.stringify({
        event: "customers_backfill_run",
        ordersScanned: report.ordersScanned,
        customersCreated: report.customersCreated,
        ordersMerged: report.ordersMerged,
        failures: report.failures.length,
      }),
    );
    return NextResponse.json({ ...report, remaining: pendingOrders });
  } catch (e) {
    console.error(JSON.stringify({ event: "customers_backfill_run_failed", error: String(e) }));
    return NextResponse.json({ error: "run_failed" }, { status: 500 });
  }
}
