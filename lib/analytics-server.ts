import type { AnalyticsItem } from "@/lib/analytics-types";

/**
 * CALL ME FROM THE STRIPE WEBHOOK.
 *
 * Server-side `purchase` event via GA4 Measurement Protocol. This module is
 * intentionally not wired anywhere in Phase 1 — the current checkout API
 * route does not represent a real payment, and firing purchase events from
 * there would pollute GA4 with non-revenue data.
 *
 * When Stripe is integrated, call this from the `checkout.session.completed`
 * (or `payment_intent.succeeded`) webhook handler. Reuse the order's
 * persisted `transaction_id` so client + server events deduplicate in GA4.
 */
export type ServerPurchaseInput = {
  clientId: string;
  transaction_id: string;
  value: number;
  tax: number;
  shipping: number;
  items: AnalyticsItem[];
};

export async function sendPurchaseToGA4(input: ServerPurchaseInput): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  const url =
    `https://www.google-analytics.com/mp/collect` +
    `?measurement_id=${encodeURIComponent(measurementId)}` +
    `&api_secret=${encodeURIComponent(apiSecret)}`;

  const body = {
    client_id: input.clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: input.transaction_id,
          value: input.value,
          currency: "USD",
          tax: input.tax,
          shipping: input.shipping,
          items: input.items,
        },
      },
    ],
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // fire-and-forget — never block on analytics
  }
}
