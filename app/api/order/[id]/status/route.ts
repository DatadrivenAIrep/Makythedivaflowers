import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // paymentStatus is the source of truth for "paid": a web order is charged
  // (paymentStatus="paid") while its fulfillment status stays "pending", so the
  // client needs both fields to know when to show the confirmation.
  return NextResponse.json({ status: order.status, paymentStatus: order.paymentStatus });
}
