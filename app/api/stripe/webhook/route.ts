import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe-server";
import { updateOrderStatusByPaymentIntent } from "@/lib/order-storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("missing signature", { status: 400 });
  }

  const body = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET not set");
    return new NextResponse("server misconfigured", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    console.error("[stripe] invalid webhook signature", e);
    return new NextResponse("invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await updateOrderStatusByPaymentIntent(pi.id, "paid");
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await updateOrderStatusByPaymentIntent(pi.id, "failed");
        break;
      }
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await updateOrderStatusByPaymentIntent(pi.id, "canceled");
        break;
      }
      default:
        // Ignore other events; do not 5xx (Stripe would retry).
        break;
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[stripe] webhook handler failed", e);
    return new NextResponse("handler failed", { status: 500 });
  }
}
