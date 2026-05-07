import type { AnalyticsItem } from "@/lib/analytics-types";

/**
 * Server-side `purchase` event via GA4 Measurement Protocol.
 * Wired into app/api/stripe/webhook/route.ts on `payment_intent.succeeded`.
 * Shares `transaction_id` (order.id) with the client-side purchase event
 * so GA4 dedupes them within 24h.
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
