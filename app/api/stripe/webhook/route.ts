import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe-server";
import { getOrderByPaymentIntent, updateOrderStatusByPaymentIntent } from "@/lib/order-storage";
import { notifyOrderPaid } from "@/lib/order-notifications";
import { enqueuePrintJob } from "@/lib/print-queue";
import { sendPurchaseToGA4 } from "@/lib/analytics-server";
import { resolveCartLines } from "@/lib/cart-helpers";
import { resolvedLineToAnalyticsItem, centsToDollars } from "@/lib/analytics-types";
import { PRODUCTS } from "@/data/products";
import type { Order } from "@/types/order";

export const runtime = "nodejs";

function orderToPurchasePayload(order: Order) {
  const resolved = resolveCartLines(order.lines, PRODUCTS);
  return {
    clientId: order.id,
    transaction_id: order.id,
    value: centsToDollars(order.totals.totalCents),
    tax: centsToDollars(order.totals.taxCents),
    shipping: centsToDollars(order.totals.deliveryCents),
    items: resolved.map(resolvedLineToAnalyticsItem),
  };
}

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
        const order = await getOrderByPaymentIntent(pi.id);
        const wasAlreadyPaid = order?.status === "paid";
        await updateOrderStatusByPaymentIntent(pi.id, "paid");
        if (order && !wasAlreadyPaid) {
          await notifyOrderPaid(order);
          void sendPurchaseToGA4(orderToPurchasePayload(order));
          try {
            await enqueuePrintJob(order);
          } catch (e) {
            console.error("[print] enqueue failed for order", order.id, e);
            // Do not propagate: payment is recorded; print can be re-issued manually.
          }
        }
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
