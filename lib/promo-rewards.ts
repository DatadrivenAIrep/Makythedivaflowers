import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getPromoById } from "@/lib/promo";
import { issueGiftCard } from "@/lib/gift-card-storage";
import { grantLoyaltyReward, REFERRAL_CENTS, LOYALTY_AT_ORDER } from "@/lib/promo-grants";
import { sendSms } from "@/lib/twilio-server";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";
import { OPT_OUT_FOOTER } from "@/lib/campaign-sender";
import type { Order } from "@/types/order";

/**
 * What the shop owes someone once an order is actually paid: a referral credit
 * to whoever introduced this buyer, and the loyalty reward when they reach their
 * fifth order.
 *
 * Runs after payment, never before — a code applied at checkout that is then
 * abandoned must not pay anybody. Nothing in here is allowed to throw: the money
 * has already moved, and a failed courtesy must not fail the order.
 */

type CustomerRow = { id: string; name: string; phone: string; locale: string | null };

function customer(id: string): CustomerRow | null {
  const row = getDb()
    .prepare("SELECT id, name, phone, locale FROM customers WHERE id = ?")
    .get(id) as CustomerRow | undefined;
  return row ?? null;
}

function optedIntoMarketing(customerId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM customers c
        WHERE c.id = ?
          AND (c.messaging_channel IS NULL OR c.messaging_channel <> 'none')
          AND EXISTS (SELECT 1 FROM customer_tags t
                       WHERE t.customer_id = c.id AND t.tag = 'sms-marketing')
        LIMIT 1`,
    )
    .get(customerId);
  return Boolean(row);
}

function paidOrderCount(customerId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND payment_status = 'paid'")
    .get(customerId) as { n: number };
  return row.n;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "";
}

async function text(to: string, body: string, locale: "en" | "es"): Promise<void> {
  const message = `${body} ${OPT_OUT_FOOTER[locale]}`;
  if (!twilioSmsEnabled() || twilioDryRun()) {
    console.log(JSON.stringify({ event: "promo_reward_dry_run", to, body: message }));
    return;
  }
  await sendSms(to, message);
}

/**
 * Credit the referrer, if this order used a referral code.
 *
 * The credit is a gift card rather than another promo code: it is money the
 * customer has earned and can spend across orders, and gift cards already draw
 * down partially. Idempotent per order — a retried webhook must not pay twice.
 */
async function creditReferrer(order: Order): Promise<void> {
  if (!order.promoId) return;
  const promo = getPromoById(order.promoId);
  if (!promo?.referrerCustomerId) return;

  const referrer = customer(promo.referrerCustomerId);
  if (!referrer) return;

  // The order id is the idempotency key, stored in the same column the purchase
  // flow already made unique — a retried webhook inserts nothing the second time.
  const key = `referral:${order.id}`;
  const db = getDb();
  if (db.prepare("SELECT 1 FROM gift_cards WHERE purchase_payment_intent_id = ? LIMIT 1").get(key)) {
    return;
  }

  const card = issueGiftCard({
    initialCents: REFERRAL_CENTS,
    // No inbox to mail: this credit is delivered by text, and the address is a
    // placeholder so the column stays non-null and obviously internal.
    recipientEmail: `referral+${referrer.id}@invalid.local`,
    recipientName: referrer.name,
    fromLabel: "Diva Flowers",
    reason: "referral",
    issuedBy: "referral",
  });
  db.prepare("UPDATE gift_cards SET purchase_payment_intent_id = ? WHERE id = ?").run(key, card.id);

  const locale = referrer.locale === "en" ? "en" : "es";
  const name = firstName(referrer.name);
  const body =
    locale === "es"
      ? `${name ? `${name}, ` : ""}alguien usó tu código. Te acreditamos $15 para tu próximo pedido: ${card.code}`
      : `${name ? `${name}, ` : ""}someone used your code. We credited you $15 toward your next order: ${card.code}`;
  await text(referrer.phone, body, locale);
}

/** Text the loyalty code the moment the customer's fifth order comes into view. */
async function loyalty(order: Order): Promise<void> {
  if (!order.customerId) return;
  if (!optedIntoMarketing(order.customerId)) return;
  // Granted once four are behind them, so the fifth is the discounted one.
  if (paidOrderCount(order.customerId) !== LOYALTY_AT_ORDER - 1) return;

  const c = customer(order.customerId);
  if (!c) return;
  const granted = grantLoyaltyReward(order.customerId);
  if (!granted) return;

  const locale = c.locale === "en" ? "en" : "es";
  const name = firstName(c.name);
  const body =
    locale === "es"
      ? `${name ? `Gracias, ${name}. ` : "Gracias. "}Tu próximo pedido lleva $15 menos con el código ${granted.code}`
      : `${name ? `Thank you, ${name}. ` : "Thank you. "}Your next order is $15 off with the code ${granted.code}`;
  await text(c.phone, body, locale);
}

export async function rewardsOnOrderPaid(order: Order): Promise<void> {
  runMigrations();
  try {
    await creditReferrer(order);
  } catch (e) {
    console.error("[rewards] referral credit failed", order.id, e);
  }
  try {
    await loyalty(order);
  } catch (e) {
    console.error("[rewards] loyalty grant failed", order.id, e);
  }
}
