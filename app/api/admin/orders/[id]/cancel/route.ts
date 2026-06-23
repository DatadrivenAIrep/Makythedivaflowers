import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelOrder } from "@/lib/order-mutations";
import { getOrder } from "@/lib/order-storage";
import { refund } from "@/lib/gift-card-storage";

export const runtime = "nodejs";

const body = z.object({
  refund: z.boolean(),
  reason: z.string().max(500).optional(),
});

async function restoreGiftCardIfNeeded(id: string): Promise<void> {
  try {
    const order = await getOrder(id);
    if (order?.giftCardId && order.giftCardCents && order.giftCardCents > 0) {
      try {
        refund(order.giftCardId, order.id, order.giftCardCents);
      } catch (e) {
        console.error("[gift-card] refund on cancel failed for order", id, e);
      }
    }
  } catch (e) {
    console.error("[gift-card] getOrder failed during cancel for order", id, e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const order = await cancelOrder(id, parsed.data);
    await restoreGiftCardIfNeeded(id);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
