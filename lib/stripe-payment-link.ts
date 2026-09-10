import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe-server";
import { updateOrderCheckoutSessionId } from "@/lib/order-storage";
import type { Order } from "@/types/order";

const TWENTY_FOUR_HOURS_SECONDS = 60 * 60 * 24;

export function buildCheckoutSessionParams(
  order: Order,
  locale: "en" | "es",
): Stripe.Checkout.SessionCreateParams {
  // NEXT_PUBLIC_SITE_URL is the name the rest of the app uses (sitemap, gift-card
  // notifications) and the only one that is actually set. Reading a bare SITE_URL
  // here left this empty in production, so success_url went out as a relative
  // path and Stripe rejected every session with url_invalid. The literal fallback
  // keeps payment links working even when no env var is configured.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://makythedivaflowers.com";
  const windowDate =
    order.fulfillment.method !== "in-store" && "window" in order.fulfillment
      ? order.fulfillment.window.date
      : "TBD";
  const description = `${order.lines.length} item${order.lines.length === 1 ? "" : "s"} · entrega ${windowDate}`;

  return {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: order.totals.totalCents,
          product_data: {
            name: `Diva Flowers · pedido ${order.id}`,
            description,
          },
        },
        quantity: 1,
      },
    ],
    metadata: { orderId: order.id },
    client_reference_id: order.id,
    customer_email: order.contact.email || undefined,
    expires_at: Math.floor(Date.now() / 1000) + TWENTY_FOUR_HOURS_SECONDS,
    success_url: `${siteUrl}/${locale}/order/${order.id}/confirmation`,
    cancel_url: `${siteUrl}/${locale}/admin/intake`,
    payment_intent_data: {
      metadata: { orderId: order.id },
    },
  };
}

export async function createCheckoutSession(
  order: Order,
  locale: "en" | "es",
): Promise<{ id: string; url: string; expiresAt: number }> {
  const params = buildCheckoutSessionParams(order, locale);
  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) throw new Error("stripe_session_no_url");
  await updateOrderCheckoutSessionId(order.id, session.id);
  return { id: session.id, url: session.url, expiresAt: session.expires_at };
}
