// lib/stripe-server.ts
import "server-only";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(secretKey, {
  // The SDK pins the API version it was built against. Don't override unless we
  // want to test forward compatibility on a specific version.
  typescript: true,
});
