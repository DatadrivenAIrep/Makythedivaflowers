import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { acknowledgeOrder } from "@/lib/order-acknowledgments";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  acknowledgeOrder(id, "maky"); // single-user admin for now
  return NextResponse.json({ acknowledgedAt: new Date().toISOString() });
}
