import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { digitalCardView, enableForOrder, getByOrder, setTargetUrl } from "@/lib/digital-cards";
import { recordOrderChange } from "@/lib/order-history";
import { digitalCardPatchSchema } from "@/schemas/digital-card";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = getByOrder(id);
  const card = existing ?? enableForOrder(id);
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!existing) {
    await recordOrderChange({ orderId: id, actor: "maky", kind: "digital_card", summary: "Tarjeta digital activada" });
  }
  return NextResponse.json(digitalCardView(card));
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_card_url" }, { status: 400 });
  }
  const parsed = digitalCardPatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_card_url" }, { status: 400 });
  const card = setTargetUrl(id, parsed.data.targetUrl);
  if (!card) return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  await recordOrderChange({
    orderId: id, actor: "maky", kind: "digital_card", summary: "URL de tarjeta digital actualizada",
  });
  return NextResponse.json(digitalCardView(card));
}
