import { NextResponse } from "next/server";
import { listDeliveriesForDate } from "@/lib/order-storage";

export const runtime = "nodejs";

function todayLocalISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const date = sp.get("date") ?? todayLocalISODate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  const orders = await listDeliveriesForDate(date);
  return NextResponse.json({ date, orders });
}
