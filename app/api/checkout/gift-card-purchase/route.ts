import { NextResponse } from "next/server";
import { giftCardPurchaseSchema } from "@/schemas/gift-card-purchase";
import { stripe } from "@/lib/stripe-server";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Start payment for a gift card the customer is buying.
 *
 * The card is deliberately NOT issued here — an abandoned checkout would mint
 * stored value nobody paid for. Everything needed to issue it rides along in the
 * payment metadata, and the Stripe webhook creates the card once the money has
 * actually moved.
 */
export async function POST(req: Request) {
  const ip = ipFromRequest(req);
  const rl = rateLimit(`gift-card-purchase:${ip}`, { max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ errors: { formErrors: ["rate_limited"] } }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = giftCardPurchaseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: d.amountCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        // Stripe metadata values must be strings.
        metadata: {
          kind: "gift_card",
          amountCents: String(d.amountCents),
          recipientEmail: d.recipientEmail,
          recipientName: d.recipientName || "",
          fromLabel: d.fromLabel || "",
          personalMessage: d.personalMessage || "",
          purchaserEmail: d.purchaserEmail,
          locale: d.locale,
        },
        receipt_email: d.purchaserEmail,
      },
      // One payment per buyer+recipient+amount within a minute; a double-click
      // must not create two intents.
      { idempotencyKey: `gc_${d.purchaserEmail}_${d.recipientEmail}_${d.amountCents}_${Math.floor(Date.now() / 60000)}` },
    );
    if (!paymentIntent.client_secret) {
      return NextResponse.json({ errors: { formErrors: ["payment_init_failed"] } }, { status: 502 });
    }
    return NextResponse.json({ clientSecret: paymentIntent.client_secret }, { status: 200 });
  } catch (e) {
    console.error("[gift-card] paymentIntents.create failed", e);
    return NextResponse.json({ errors: { formErrors: ["payment_init_failed"] } }, { status: 502 });
  }
}
