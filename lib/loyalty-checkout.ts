import "server-only";
import { lookupCustomer, LoyaltyApiError } from "@/lib/loyalty-client";
import { applicableRewards, rewardDiscountCents } from "@/lib/loyalty-rewards";
import { readProof } from "@/lib/loyalty-proof";
import { e164 } from "@/lib/twilio-server";

const CHECKOUT_TIMEOUT_MS = 2500;

export type RewardDiscount =
  | { ok: true; rewardId: string; label: string; percent: number; discountCents: number }
  | { ok: false; reason: "proof_invalid" | "reward_unavailable" };

/**
 * Prices a loyalty reward on the server. The client only supplies the reward id
 * and a signed proof; label and percent always come from the program (or, when
 * it cannot be reached, from the proof the server itself signed).
 */
export async function resolveRewardDiscount(input: {
  phone: string;
  rewardId: string;
  proof: string;
  subtotalCents: number;
}): Promise<RewardDiscount> {
  const proven = readProof(input.proof, input.phone)?.rewards.find((r) => r.id === input.rewardId);
  if (!proven) return { ok: false, reason: "proof_invalid" };

  let chosen = proven;
  try {
    const customer = await lookupCustomer(e164(input.phone), { timeoutMs: CHECKOUT_TIMEOUT_MS });
    const current = customer
      ? applicableRewards(customer.rewards.available).find((r) => r.id === input.rewardId)
      : undefined;
    if (!current) return { ok: false, reason: "reward_unavailable" };
    chosen = current;
  } catch (e) {
    if (!(e instanceof LoyaltyApiError)) throw e;
    // Program down or slow: the proof was signed by us moments ago, so honour it.
    console.error("[loyalty] lookup failed, using proof", { name: e.name, code: e.code, status: e.status });
  }

  return {
    ok: true,
    rewardId: chosen.id,
    label: chosen.label,
    percent: chosen.percent,
    discountCents: rewardDiscountCents(input.subtotalCents, chosen.percent),
  };
}
