import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { getDb } from "@/lib/db";
import { recentMessagesForOrder } from "@/lib/message-storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const customer = order.customerId
    ? getDb().prepare("SELECT * FROM customers WHERE id = ?").get(order.customerId)
    : null;
  const messages = recentMessagesForOrder(id, 50);
  return NextResponse.json({ order, customer, messages });
}
