import { NextResponse } from "next/server";
import { getPendingQueue } from "@/lib/order-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const items = await getPendingQueue();
  return NextResponse.json({
    items: items.map((i) => ({ orderId: i.orderId, reason: i.reason, order: i.order })),
    generatedAt: new Date().toISOString(),
  });
}
