import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { loyaltyEnabled, lookupCustomer } from "@/lib/loyalty-client";
import { applicableRewards } from "@/lib/loyalty-rewards";
import { createCode } from "@/lib/loyalty-proof";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";
import { e164, sendSms } from "@/lib/twilio-server";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().regex(/^[+\d\s().-]{7,20}$/),
  locale: z.enum(["es", "en"]).default("es"),
});

const MESSAGE = {
  es: (code: string) => `Tu código de Diva Flowers es ${code}. Vence en 10 minutos.`,
  en: (code: string) => `Your Diva Flowers code is ${code}. It expires in 10 minutes.`,
};

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ reason: "invalid" }, { status: 400 });
  const { locale } = parsed.data;
  const phone = e164(parsed.data.phone);

  const limited = NextResponse.json({ reason: "rate_limited" }, { status: 429 });
  if (!rateLimit(`loyalty-code-ip:${ipFromRequest(req)}`, { max: 10, windowMs: 60_000 }).ok) return limited;
  if (!rateLimit(`loyalty-code-phone:${phone}`, { max: 3, windowMs: 3_600_000 }).ok) return limited;

  // The answer is the same whether or not a text went out, so this route
  // cannot be used to learn which numbers hold a card.
  const sent = NextResponse.json({ sent: true });
  if (!loyaltyEnabled() || !twilioSmsEnabled()) return sent;

  try {
    const customer = await lookupCustomer(phone, { timeoutMs: 2500 });
    if (!customer || applicableRewards(customer.rewards.available).length === 0) return sent;

    const body = MESSAGE[locale](createCode(phone));
    if (twilioDryRun()) {
      console.log(JSON.stringify({ event: "promo_reward_dry_run", to: phone, body }));
    } else {
      await sendSms(phone, body);
    }
  } catch {
    // API or Twilio failure: the shopper simply gets no code and can retry.
  }
  return sent;
}
