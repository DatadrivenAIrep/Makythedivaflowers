import { NextResponse } from "next/server";
import { recentMessagesForOrder } from "@/lib/message-storage";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = recentMessagesForOrder(id, 1);
  if (rows.length === 0) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, ...rows[0] });
}
