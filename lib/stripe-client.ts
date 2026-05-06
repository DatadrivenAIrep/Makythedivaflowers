// lib/stripe-client.ts
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";

let stripePromise: Promise<StripeJs | null> | null = null;

export function getStripeClient(): Promise<StripeJs | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      // eslint-disable-next-line no-console
      console.error("[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
