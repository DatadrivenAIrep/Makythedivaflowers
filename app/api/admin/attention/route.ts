import { NextResponse } from "next/server";
import { getAttention } from "@/lib/attention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-gated at the edge by proxy.ts (Next 16's renamed middleware): its
// matcher covers "/api/admin/:path*" and returns 401 for any request without a
// valid intake_session cookie — same as every other /api/admin/* route, so no
// per-route guard is needed here.
export async function GET(): Promise<Response> {
  const snapshot = await getAttention();
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
