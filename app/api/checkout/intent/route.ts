import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSchema } from "@/schemas/checkout";
import { computeOrderTotals, computeDeliveryCentsForZip } from "@/lib/totals";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { PRODUCTS } from "@/data/products";
import { getAllPriceOverrides, applyPriceOverrides } from "@/lib/product-prices";
import { saveOrder, updateOrderPaymentIntent, getOrder } from "@/lib/order-storage";
import { stripe } from "@/lib/stripe-server";
import type Stripe from "stripe";
import { validateForRedemption, redeem } from "@/lib/gift-card-storage";
import { validatePromo, redeemPromo } from "@/lib/promo";
import { buyerHasPaidOrder } from "@/lib/buyer-history";
import { notifyOrderPaid } from "@/lib/order-notifications";
import { enqueuePrintJob } from "@/lib/print-queue";
import { onWebOrderPaid } from "@/lib/on-web-order-paid";
import type { Order, OrderFulfillment, CartLine } from "@/types/order";

export const runtime = "nodejs";

const cartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  addOnIds: z.array(z.string()),
  qty: z.number().int().min(1).max(99),
});

const requestSchema = z.object({
  locale: z.enum(["en", "es"]),
  lines: z.array(cartLineSchema).min(1, "cart_empty"),
  form: checkoutSchema,
  giftCardCode: z.string().min(1).max(50).optional(),
  // Only the code travels from the client. The discount is always recomputed
  // here, so a tampered request cannot dictate its own price.
  promoCode: z.string().min(1).max(50).optional(),
  // Capped rather than open-ended: a typo turning $10 into $1,000 should be
  // refused, not charged. Staff can take a larger tip over the phone.
  tipCents: z.number().int().min(0).max(20000).optional(),
  // The order this checkout already opened, echoed back by the client. Lets a
  // buyer who changes the tip or fixes an address re-price that row instead of
  // leaving another pending order — and another Stripe intent — behind.
  // Ignored unless it names an unpaid web order belonging to the same buyer.
  orderId: z.string().min(1).max(64).optional(),
});

/** Same buyer when either the email or the last 10 phone digits match. */
function sameBuyer(
  a: { email?: string; phone?: string },
  b: { email?: string; phone?: string },
): boolean {
  const mail = (s?: string) => (s ?? "").trim().toLowerCase();
  const digits = (s?: string) => (s ?? "").replace(/\D/g, "").slice(-10);
  if (mail(a.email) && mail(a.email) === mail(b.email)) return true;
  return digits(a.phone).length === 10 && digits(a.phone) === digits(b.phone);
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const { locale, lines, form } = parsed.data;

  const effectiveProducts = applyPriceOverrides(PRODUCTS, getAllPriceOverrides());

  // Web checkout never receives custom lines — stamp kind explicitly to satisfy the new union type.
  // Drop any quote-only product: it is showcased, not purchasable, so it must never
  // ride along in a mixed cart at $0 (a quote-only-only cart then falls through to cart_empty).
  const backfilledLines: CartLine[] = lines
    .map((l) => ({ kind: "catalog" as const, ...l }))
    .filter((l) => !effectiveProducts.find((p) => p.id === l.productId)?.quoteOnly);

  const subtotal = cartSubtotalCents(backfilledLines, effectiveProducts);
  if (subtotal <= 0) {
    return NextResponse.json(
      { errors: { formErrors: ["cart_empty"] } },
      { status: 400 },
    );
  }

  let deliveryCents = 0;
  if (form.delivery.method === "delivery") {
    const fee = computeDeliveryCentsForZip(form.delivery.address.zip);
    if (fee === null) {
      return NextResponse.json(
        { errors: { formErrors: ["zip_not_in_zone"] } },
        { status: 400 },
      );
    }
    deliveryCents = fee;
  }

  // --- Promo code (optional) ---
  let promoId: string | undefined;
  let promoCode: string | undefined;
  let discountCents = 0;
  if (parsed.data.promoCode) {
    const check = validatePromo(parsed.data.promoCode, {
      subtotalCents: subtotal,
      deliveryCents,
      buyerHasOrdered: buyerHasPaidOrder({
        phone: form.contact.phone,
        email: form.contact.email,
      }),
      buyerPhone: form.contact.phone,
    });
    if (!check.ok) {
      return NextResponse.json(
        { errors: { formErrors: ["promo_invalid"], promoReason: check.reason } },
        { status: 400 },
      );
    }
    promoId = check.promo.id;
    promoCode = check.promo.code;
    discountCents = check.discountCents;
  }

  const tipCents = parsed.data.tipCents ?? 0;
  const totals = computeOrderTotals(subtotal, deliveryCents, discountCents, tipCents);

  // Take over the row this checkout already opened, when there is one. Guarded
  // so a guessed id cannot rewrite a stranger's order: it has to still be an
  // unpaid web order, and the buyer has to match. Anything else quietly starts
  // a new order rather than failing the checkout.
  let existing: Order | null = null;
  if (parsed.data.orderId) {
    const candidate = await getOrder(parsed.data.orderId);
    if (
      candidate &&
      candidate.source === "web" &&
      candidate.paymentStatus === "pending" &&
      candidate.status !== "canceled" &&
      sameBuyer(candidate.contact, form.contact)
    ) {
      existing = candidate;
    }
  }
  const orderId = existing?.id ?? `do_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  // Read before saveOrder below, which rewrites the row from this request.
  const existingPaymentIntentId = existing?.stripePaymentIntentId;

  const fulfillment: OrderFulfillment =
    form.delivery.method === "delivery"
      ? {
          method: "delivery",
          recipient: form.delivery.recipient,
          address: form.delivery.address,
          window: form.delivery.window,
          cardMessage: form.delivery.cardMessage || undefined,
        }
      : {
          method: "pickup",
          recipient: form.delivery.recipient,
          window: form.delivery.window,
          cardMessage: form.delivery.cardMessage || undefined,
        };

  const now = new Date().toISOString();
  const order: Order = {
    id: orderId,
    source: "web",
    locale,
    lines: backfilledLines,
    fulfillment,
    contact: form.contact,
    promoId,
    promoCode,
    smsConsent: form.smsConsent,
    smsMarketingConsent: form.smsMarketingConsent,
    totals,
    status: "pending",
    paymentStatus: "pending",
    // Keep the moment the buyer actually started, not the last re-price.
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  // --- Gift card (optional) ---
  let giftCardId: string | undefined;
  let giftCardCents = 0;
  if (parsed.data.giftCardCode) {
    const check = validateForRedemption(parsed.data.giftCardCode, totals.totalCents);
    if (!check.ok) {
      return NextResponse.json({ errors: { formErrors: ["gift_card_invalid"] } }, { status: 400 });
    }
    giftCardId = check.card.id;
    giftCardCents = check.applicableCents;
  }
  const amountToCharge = totals.totalCents - giftCardCents;

  order.giftCardId = giftCardId;
  order.giftCardCents = giftCardCents || undefined;

  // Full coverage: no Stripe charge. Redeem now, mark paid by gift card, fire side effects.
  if (giftCardId && amountToCharge <= 0) {
    order.paymentStatus = "paid";
    order.paymentMethod = "gift-card";
    order.paidAt = now;
    try {
      await saveOrder(order);
      redeem(giftCardId, order.id, giftCardCents);
      if (promoId) redeemPromo(promoId, order.id, discountCents);
    } catch (e) {
      console.error("[intent] gift card full-coverage failed", e);
      return NextResponse.json({ errors: { formErrors: ["gift_card_invalid"] } }, { status: 400 });
    }
    await notifyOrderPaid(order);
    try {
      await enqueuePrintJob(order);
    } catch (e) {
      console.error("[print] enqueue failed for order", order.id, e);
    }
    await onWebOrderPaid(order.id);
    return NextResponse.json({ paid: true, orderId }, { status: 200 });
  }

  // Partial or no gift card: charge the remainder via Stripe (debit happens in the webhook).
  try {
    await saveOrder(order);
  } catch (e) {
    console.error("[stripe] saveOrder failed", e);
    return NextResponse.json({ errors: { formErrors: ["unknown_error"] } }, { status: 500 });
  }

  try {
    const shared = {
      amount: amountToCharge,
      metadata: {
        orderId,
        locale,
        fulfillmentMethod: fulfillment.method,
        ...(giftCardId ? { giftCardId, giftCardCents: String(giftCardCents) } : {}),
        ...(promoId
          ? { promoId, promoCode: promoCode ?? "", promoDiscountCents: String(discountCents) }
          : {}),
      },
      receipt_email: form.contact.email,
    };

    // Re-price the intent the buyer is already looking at. Opening a new one per
    // change is what left a trail of "incomplete" intents in Stripe.
    let paymentIntent: Stripe.PaymentIntent | null = null;
    if (existingPaymentIntentId) {
      try {
        paymentIntent = await stripe.paymentIntents.update(existingPaymentIntentId, shared);
      } catch (e) {
        // Confirmed, cancelled or otherwise frozen: open a fresh one instead of
        // failing a checkout the buyer is standing in front of.
        console.error("[stripe] paymentIntents.update failed", existingPaymentIntentId, e);
      }
    }
    if (!paymentIntent) {
      paymentIntent = await stripe.paymentIntents.create(
        { ...shared, currency: "usd", automatic_payment_methods: { enabled: true } },
        // Keyed on the amount as well: a retried request stays idempotent, but a
        // re-priced checkout must not be handed back the intent for the old total.
        { idempotencyKey: `${orderId}:${amountToCharge}` },
      );
    }
    if (!paymentIntent.client_secret) {
      console.error("[stripe] paymentIntent.client_secret is null", paymentIntent.id);
      return NextResponse.json(
        { errors: { formErrors: ["payment_init_failed"] } },
        { status: 502 },
      );
    }
    await updateOrderPaymentIntent(orderId, paymentIntent.id);
    return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId }, { status: 200 });
  } catch (e) {
    console.error("[stripe] paymentIntents.create failed", e);
    return NextResponse.json(
      { errors: { formErrors: ["payment_init_failed"] } },
      { status: 502 },
    );
  }
}
