import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrder } from "@/lib/order-storage";
import { sendPaymentReminder } from "@/lib/payment-reminder";

export const runtime = "nodejs";

// "Recordar pago" for one order. Returns { ok, reason? } so the Bandeja can
// show the outcome — never a 500 for a business-rule skip (opted out, already
// reminded today, nothing due…).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  return NextResponse.json(await sendPaymentReminder(order));
}
