// Stripe Checkout for the remaining due on a statement. Follows
// lib/stripe-payment-link.ts without touching it: the order flow and the
// statement flow share nothing but the Stripe client.
import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe-server";
import { dueCents } from "@/lib/house-account-settlement";
import { statementUrl } from "@/lib/house-account-templates";
import type { Statement, HouseAccount } from "@/types/house-account";

const TWENTY_FOUR_HOURS_SECONDS = 60 * 60 * 24;

export function buildStatementCheckoutParams(statement: Statement, account: HouseAccount): Stripe.Checkout.SessionCreateParams {
  const amount = dueCents(statement);
  if (amount <= 0) throw new Error("nothing_due");
  const url = statementUrl(statement.code);
  const metadata = { kind: "house_statement", statementId: statement.id, accountId: account.id };
  return {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: { name: `Estado de cuenta ${statement.number} · Diva Flowers`, description: account.name },
        },
        quantity: 1,
      },
    ],
    metadata,
    client_reference_id: statement.id,
    customer_email: account.billingEmail || undefined,
    expires_at: Math.floor(Date.now() / 1000) + TWENTY_FOUR_HOURS_SECONDS,
    success_url: `${url}?paid=1`,
    cancel_url: url,
    payment_intent_data: { metadata },
  };
}

export async function createStatementCheckout(statement: Statement, account: HouseAccount): Promise<{ id: string; url: string }> {
  const session = await stripe.checkout.sessions.create(buildStatementCheckoutParams(statement, account));
  if (!session.url) throw new Error("stripe_session_no_url");
  return { id: session.id, url: session.url };
}
