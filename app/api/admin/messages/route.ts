import { NextResponse } from "next/server";
import { listConversations } from "@/lib/conversation-storage";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return NextResponse.json({ conversations: listConversations() });
}
