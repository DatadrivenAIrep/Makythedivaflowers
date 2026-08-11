import { NextResponse } from "next/server";
import { getAttention } from "@/lib/attention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE: intentionally unguarded to mirror its sibling dashboard endpoints
// (/api/admin/orders/queue, /api/admin/orders/feed). See the plan's
// "Known constraint" note — do not add requireAdmin here in isolation.
export async function GET(): Promise<Response> {
  const snapshot = await getAttention();
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
