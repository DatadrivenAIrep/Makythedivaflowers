import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getReceivables } from "@/lib/order-receivables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Por cobrar" on the Bandeja: past orders that still owe money. */
export async function GET(req: Request): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(getReceivables(), { headers: { "cache-control": "no-store" } });
}
