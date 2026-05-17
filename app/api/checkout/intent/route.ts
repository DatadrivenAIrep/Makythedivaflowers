import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSchema } from "@/schemas/checkout";
import { computeOrderTotals, computeDeliveryCentsForZip } from "@/lib/totals";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { PRODUCTS } from "@/data/products";
import { saveOrder, updateOrderPaymentIntent } from "@/lib/order-storage";
import { stripe } from "@/lib/stripe-server";
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

  const subtotal = cartSubtotalCents(backfilledLines, PRODUCTS);
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

  try {
    await saveOrder(order);
  } catch (e) {
    console.error("[stripe] saveOrder failed", e);
    return NextResponse.json(
      { errors: { formErrors: ["unknown_error"] } },
      { status: 500 },
    );
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totals.totalCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: { orderId, locale, fulfillmentMethod: fulfillment.method },
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
    return NextResponse.json(
      { clientSecret: paymentIntent.client_secret, orderId },
      { status: 200 },
    );
  } catch (e) {
    console.error("[stripe] paymentIntents.create failed", e);
    return NextResponse.json(
      { errors: { formErrors: ["payment_init_failed"] } },
      { status: 502 },
    );
  }
}
