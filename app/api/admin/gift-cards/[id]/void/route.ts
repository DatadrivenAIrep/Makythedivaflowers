import { NextResponse } from "next/server";
import { getGiftCardById, voidGiftCard } from "@/lib/gift-card-storage";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getGiftCardById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  voidGiftCard(id);
  return NextResponse.json({ ok: true });
}
