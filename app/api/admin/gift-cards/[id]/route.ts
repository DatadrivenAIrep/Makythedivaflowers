import { NextResponse } from "next/server";
import { getGiftCardWithHistory } from "@/lib/gift-card-storage";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = getGiftCardWithHistory(id);
  if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(res);
}
