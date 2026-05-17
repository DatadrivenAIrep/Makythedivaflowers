import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { createCheckoutSession } from "@/lib/stripe-payment-link";
import { dispatchOrderReceived } from "@/lib/order-dispatch";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.paymentStatus === "paid") {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }
  try {
    const session = await createCheckoutSession(order, order.locale);
    // Re-dispatch with the new link — fresh payment_link message.
    await dispatchOrderReceived(
      { ...order, stripeCheckoutSessionId: session.id },
      session.url,
    );
    return NextResponse.json(
      { url: session.url, expiresAt: session.expiresAt },
      { status: 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
