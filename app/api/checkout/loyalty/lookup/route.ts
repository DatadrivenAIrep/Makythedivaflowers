import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { loyaltyEnabled, lookupCustomer } from "@/lib/loyalty-client";
import { applicableRewards } from "@/lib/loyalty-rewards";
import { twilioSmsEnabled } from "@/lib/twilio-config";
import { e164 } from "@/lib/twilio-server";

export const runtime = "nodejs";

const schema = z.object({ phone: z.string().regex(/^[+\d\s().-]{7,20}$/) });

// Never returns the customer's name, stamps or visits: only what a shopper
// needs to decide whether to verify.
export async function POST(req: Request) {
  const rl = rateLimit(`loyalty-lookup:${ipFromRequest(req)}`, { max: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ reason: "rate_limited" }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ reason: "invalid" }, { status: 400 });

  if (!loyaltyEnabled()) return NextResponse.json({ status: "unavailable" });

  let customer;
  try {
    customer = await lookupCustomer(e164(parsed.data.phone), { timeoutMs: 2500 });
  } catch {
    return NextResponse.json({ status: "unavailable" });
  }
  if (!customer) return NextResponse.json({ status: "no_card" });

  // Without SMS there is no way to verify, so offer no rewards; the join box stays.
  const rewards = twilioSmsEnabled() ? applicableRewards(customer.rewards.available) : [];
  return NextResponse.json({ status: "card", rewards });
}
