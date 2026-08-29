import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { dispatchReviewRequest } from "@/lib/order-dispatch";

export const runtime = "nodejs";

// Manually send the Google-review-request SMS for one order (the shop chooses which
// delivered/picked-up orders to ask). Returns { ok, reason? } so the drawer can show
// the outcome — never a 500 for a business-rule skip (no link, opted out, etc.).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const result = await dispatchReviewRequest(order);
  return NextResponse.json(result);
}
