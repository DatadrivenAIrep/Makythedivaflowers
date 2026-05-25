import { NextResponse } from "next/server";
import { getRecentFeed } from "@/lib/order-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const sinceHours = Math.max(1, Math.min(168, Number(sp.get("sinceHours") ?? "24")));
  const data = await getRecentFeed(sinceHours);
  return NextResponse.json(data);
}
