import { NextResponse } from "next/server";
import { getGiftCardById } from "@/lib/gift-card-storage";
import { notifyGiftCardIssued } from "@/lib/gift-card-notifications";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const card = getGiftCardById(id);
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const mail = await notifyGiftCardIssued(card, "es");
  return NextResponse.json({ ok: mail.sent, error: mail.error });
}
