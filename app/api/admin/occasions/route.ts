import { NextResponse } from "next/server";
import { listUpcomingOccasions } from "@/lib/customer-dates-storage";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const raw = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 366) : 30;
  return NextResponse.json({ occasions: listUpcomingOccasions(days) });
}
