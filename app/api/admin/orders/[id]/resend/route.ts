import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrder } from "@/lib/order-storage";
import { createCheckoutSession } from "@/lib/stripe-payment-link";
import { dispatchOrderReceived, dispatchPaymentConfirmed } from "@/lib/order-dispatch";

export const runtime = "nodejs";

const body = z.object({ kind: z.enum(["payment_link", "confirmation"]) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (parsed.data.kind === "payment_link") {
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ error: "already_paid" }, { status: 409 });
    }
    const session = await createCheckoutSession(order, order.locale);
    await dispatchOrderReceived(
      { ...order, stripeCheckoutSessionId: session.id },
      session.url,
    );
    return NextResponse.json({ url: session.url });
  }

  // confirmation
  if (order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "not_paid" }, { status: 409 });
  }
  await dispatchPaymentConfirmed(order);
  return NextResponse.json({ ok: true });
}
