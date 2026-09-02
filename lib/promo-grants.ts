import "server-only";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createPromo, listPromos, onlyDigits, type Promo } from "@/lib/promo";

/**
 * The three codes the shop hands out on its own: the welcome offer, a referral
 * code, and the loyalty reward.
 *
 * The amounts are Maky's, agreed 2026-09-02:
 *   - welcome: 10% off a first order of $75 or more
 *   - referral: $15 for the friend, and $15 credited to whoever referred them
 *     once that order is actually paid
 *   - loyalty: $15 off the fifth order
 *
 * Every code minted here is single-use and bound to the phone it was sent to,
 * except the referral code, which is meant to be shared — that one is bound to
 * the referrer only so they cannot spend it on themselves.
 */

export const WELCOME_PERCENT = 10;
export const WELCOME_MIN_SUBTOTAL_CENTS = 7500;
export const WELCOME_TTL_DAYS = 30;

export const REFERRAL_CENTS = 1500;
export const REFERRAL_MIN_SUBTOTAL_CENTS = 7500;

export const LOYALTY_CENTS = 1500;
export const LOYALTY_TTL_DAYS = 90;
/** The order that gets the discount, so it is granted once four are behind them. */
export const LOYALTY_AT_ORDER = 5;

export type Granted = { code: string; promo: Promo };

/** Short, unambiguous over the phone: no O/0, I/1, or confusable pairs. */
const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";

function suffix(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  return out;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400_000).toISOString();
}

/** Creates a code with the given prefix, retrying the (rare) collision. */
function mint(prefix: string, make: (code: string) => Promo): Promo {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return make(`${prefix}-${suffix()}`);
    } catch (e) {
      if (String(e).includes("UNIQUE") && attempt < 5) continue;
      throw e;
    }
  }
  throw new Error("could not mint a unique promo code");
}

/** An unredeemed, still-live code of this shape already held by this person. */
function existingLive(match: (p: ReturnType<typeof listPromos>[number]) => boolean) {
  const now = Date.now();
  return listPromos().find(
    (p) =>
      match(p) &&
      p.active &&
      p.redemptionCount === 0 &&
      (!p.endsAt || Date.parse(p.endsAt) > now),
  );
}

function phoneOf(customerId: string): string | null {
  runMigrations();
  const row = getDb()
    .prepare("SELECT phone FROM customers WHERE id = ?")
    .get(customerId) as { phone: string } | undefined;
  return row?.phone ?? null;
}

/**
 * 10% off a first order of $75+, texted to one number.
 *
 * Returns the code someone already has rather than minting another: tapping the
 * popup twice should not leave two live offers against one phone.
 */
export function grantWelcomeOffer(phone: string): Granted | null {
  runMigrations();
  const digits = onlyDigits(phone);
  if (digits.length < 10) return null;

  const held = existingLive((p) => p.assignedPhone === digits && p.firstOrderOnly);
  if (held) return { code: held.code, promo: held };

  const promo = mint("HOLA", (code) =>
    createPromo({
      code,
      kind: "percent",
      value: WELCOME_PERCENT,
      minSubtotalCents: WELCOME_MIN_SUBTOTAL_CENTS,
      maxRedemptions: 1,
      firstOrderOnly: true,
      endsAt: daysFromNow(WELCOME_TTL_DAYS),
      assignedPhone: digits,
      note: "Bienvenida — automático",
    }),
  );
  return { code: promo.code, promo };
}

/**
 * The code a customer shares with a friend: $15 off for the friend, and $15
 * back to them once that order is paid (see creditReferrer).
 *
 * Stable per customer — they hand the same code to everyone — and deliberately
 * not assigned to a phone, since the whole point is that someone else uses it.
 * The referrer is kept out by phone check at redemption time.
 */
export function grantReferralCode(customerId: string): Granted | null {
  runMigrations();
  const phone = phoneOf(customerId);
  if (!phone) return null;

  const held = listPromos().find((p) => p.referrerCustomerId === customerId && p.active);
  if (held) return { code: held.code, promo: held };

  const promo = mint("AMIGA", (code) =>
    createPromo({
      code,
      kind: "fixed",
      value: REFERRAL_CENTS,
      minSubtotalCents: REFERRAL_MIN_SUBTOTAL_CENTS,
      firstOrderOnly: true,
      referrerCustomerId: customerId,
      note: `Referido de ${customerId}`,
    }),
  );
  return { code: promo.code, promo };
}

/** $15 off the next order, for a customer who has four behind them. */
export function grantLoyaltyReward(customerId: string): Granted | null {
  runMigrations();
  const phone = phoneOf(customerId);
  if (!phone) return null;
  const digits = onlyDigits(phone);

  const held = existingLive((p) => p.assignedPhone === digits && !p.firstOrderOnly);
  if (held) return { code: held.code, promo: held };

  const promo = mint("GRACIAS", (code) =>
    createPromo({
      code,
      kind: "fixed",
      value: LOYALTY_CENTS,
      maxRedemptions: 1,
      endsAt: daysFromNow(LOYALTY_TTL_DAYS),
      assignedPhone: digits,
      note: `Lealtad — pedido ${LOYALTY_AT_ORDER}`,
    }),
  );
  return { code: promo.code, promo };
}
