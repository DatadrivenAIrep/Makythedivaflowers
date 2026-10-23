import { NextResponse } from "next/server";
import { markConversationRead } from "@/lib/conversation-storage";

export const runtime = "nodejs";

// Admin-only: /api/admin/* is gated by proxy.ts.
export async function POST(_req: Request, ctx: { params: Promise<{ key: string }> }): Promise<Response> {
  const { key } = await ctx.params;
  return NextResponse.json({ marked: markConversationRead(decodeURIComponent(key)) });
}
