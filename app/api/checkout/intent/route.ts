import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSchema } from "@/schemas/checkout";
import { computeOrderTotals, computeDeliveryCentsForZip } from "@/lib/totals";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { PRODUCTS } from "@/data/products";
import { getAllPriceOverrides, applyPriceOverrides } from "@/lib/product-prices";
import { saveOrder, updateOrderPaymentIntent } from "@/lib/order-storage";
import { stripe } from "@/lib/stripe-server";
import { validateForRedemption, redeem } from "@/lib/gift-card-storage";
import { notifyOrderPaid } from "@/lib/order-notifications";
import { enqueuePrintJob } from "@/lib/print-queue";
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
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const { locale, lines, form } = parsed.data;

  // Web checkout never receives custom lines — stamp kind explicitly to satisfy the new union type.
  const backfilledLines: CartLine[] = lines.map((l) => ({ kind: "catalog" as const, ...l }));

  const effectiveProducts = applyPriceOverrides(PRODUCTS, getAllPriceOverrides());
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

  const totals = computeOrderTotals(subtotal, deliveryCents);
  const orderId = `do_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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
    totals,
    status: "pending",
    paymentStatus: "pending",
    createdAt: now,
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
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountToCharge,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          orderId,
          locale,
          fulfillmentMethod: fulfillment.method,
          ...(giftCardId ? { giftCardId, giftCardCents: String(giftCardCents) } : {}),
        },
        receipt_email: form.contact.email,
      },
      { idempotencyKey: orderId },
    );
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
