import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelOrder } from "@/lib/order-mutations";
import { getOrder } from "@/lib/order-storage";
import { refund } from "@/lib/gift-card-storage";
import { enqueueOrderReverse, runReverse } from "@/lib/loyalty-sync";

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

/**
 * Undo the order's stamp on the loyalty card. Queued first so a program outage
 * only delays it; the attempt itself is fire-and-forget. Nothing here may fail
 * or slow the cancellation.
 */
function reverseLoyaltyIfNeeded(id: string): void {
  try {
    enqueueOrderReverse(id);
    void runReverse(id).catch((e) => console.error("[loyalty] reverse on cancel failed for order", id, e));
  } catch (e) {
    console.error("[loyalty] reverse on cancel failed for order", id, e);
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
    reverseLoyaltyIfNeeded(id);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (msg === "on_account") return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
