import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe-server";
import { getOrderByPaymentIntent, updateOrderStatusByPaymentIntent, getOrderByCheckoutSessionId, updateOrderPaidByCheckoutSession } from "@/lib/order-storage";
import { dispatchPaymentConfirmed } from "@/lib/order-dispatch";
import { notifyOrderPaid } from "@/lib/order-notifications";
import { onWebOrderPaid } from "@/lib/on-web-order-paid";
import { redeem, issueGiftCardForPayment, getGiftCardByPaymentIntent } from "@/lib/gift-card-storage";
import { notifyGiftCardIssued } from "@/lib/gift-card-notifications";
import { redeemPromo } from "@/lib/promo";
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

        // A gift card the customer bought on the site. It has no order behind
        // it, so it is handled here and the order path below is skipped.
        if (pi.metadata?.kind === "gift_card") {
          try {
            // Checked before issuing so a replayed event does not mail twice.
            const alreadyIssued = getGiftCardByPaymentIntent(pi.id) !== null;
            const card = issueGiftCardForPayment({
              paymentIntentId: pi.id,
              initialCents: Number(pi.metadata.amountCents),
              recipientEmail: pi.metadata.recipientEmail,
              recipientName: pi.metadata.recipientName || undefined,
              fromLabel: pi.metadata.fromLabel || undefined,
              personalMessage: pi.metadata.personalMessage || undefined,
              purchaserEmail: pi.metadata.purchaserEmail || undefined,
            });
            // issueGiftCardForPayment is idempotent, so a replayed event returns
            // the same card. Only mail on the delivery that created it.
            if (!alreadyIssued) {
              const locale = pi.metadata.locale === "es" ? "es" : "en";
              await notifyGiftCardIssued(card, locale);
            }
          } catch (e) {
            console.error("[gift-card] issue on payment success failed", pi.id, e);
          }
          return NextResponse.json({ received: true });
        }

        const order = await getOrderByPaymentIntent(pi.id);
        // Back-compat: "paid" is an OrderStatus alias stored in status during Task 4.
        // Task 5 will move this to paymentStatus. For now, check both.
        const wasAlreadyPaid = (order?.status as string) === "paid" || order?.paymentStatus === "paid";
        await updateOrderStatusByPaymentIntent(pi.id, "paid");
        if (order && !wasAlreadyPaid) {
          if (order.giftCardId && order.giftCardCents && order.giftCardCents > 0) {
            try {
              redeem(order.giftCardId, order.id, order.giftCardCents);
            } catch (e) {
              // Order is paid; balance is single-shop courtesy. Log + alert instead of failing the webhook.
              console.error("[gift-card] redeem on payment success failed for order", order.id, e);
            }
          }
          if (order.promoId && order.totals.discountCents > 0) {
            try {
              redeemPromo(order.promoId, order.id, order.totals.discountCents);
            } catch (e) {
              // The buyer already paid the discounted amount. If two checkouts
              // raced for the last use of a limited code, log it and let the
              // order stand rather than failing a webhook Stripe will retry.
              console.error("[promo] redeem on payment success failed for order", order.id, e);
            }
          }
          await notifyOrderPaid(order);
          void sendPurchaseToGA4(orderToPurchasePayload(order));
          try {
            await enqueuePrintJob(order);
          } catch (e) {
            console.error("[print] enqueue failed for order", order.id, e);
            // Do not propagate: payment is recorded; print can be re-issued manually.
          }
          // CRM + customer SMS. Reads the order back itself, so it sees the paid
          // row written by updateOrderStatusByPaymentIntent above. Never throws.
          await onWebOrderPaid(order.id);
        }
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = (session.metadata?.orderId ?? session.client_reference_id) ?? null;
        if (!orderId) {
          console.log(JSON.stringify({ event: "checkout_session_completed_no_orderid", sessionId: session.id }));
          break;
        }
        const csOrder = await getOrderByCheckoutSessionId(session.id);
        if (!csOrder) break;
        if (csOrder.paymentStatus === "paid") break; // idempotent

        await updateOrderPaidByCheckoutSession(session.id);
        if (csOrder.source === "web") {
          // Web order paid via the admin payment-link/resend flow: route through
          // the consent-aware hook so messagingChannel reflects the checkout
          // consent box, not the default. (updateOrderPaidByCheckoutSession above
          // already marked it paid, so onWebOrderPaid re-reads a paid order.)
          await onWebOrderPaid(csOrder.id);
        } else {
          // Intake orders already have a CRM customer + chosen channel.
          await dispatchPaymentConfirmed({ ...csOrder, paymentStatus: "paid", paidAt: csOrder.paidAt ?? new Date().toISOString() });
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
