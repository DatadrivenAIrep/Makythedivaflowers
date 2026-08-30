import { NextResponse } from "next/server";
import { conversationThread } from "@/lib/conversation-storage";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }): Promise<Response> {
  const { key } = await ctx.params;
  const { conversation, thread } = conversationThread(decodeURIComponent(key));
  if (!conversation && thread.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ conversation, thread });
}
