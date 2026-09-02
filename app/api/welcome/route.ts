import { NextResponse } from "next/server";
import { z } from "zod";
import { grantWelcomeOffer, WELCOME_PERCENT } from "@/lib/promo-grants";
import { sendSms } from "@/lib/twilio-server";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";
import { getByPhoneUS, addTag } from "@/lib/customer-storage";
import { registerMarketingOptIn } from "@/lib/marketing-opt-in";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { OPT_OUT_FOOTER } from "@/lib/campaign-sender";

export const runtime = "nodejs";

const schema = z.object({
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().min(10, "phone_invalid").max(15)),
  locale: z.enum(["en", "es"]).default("es"),
  // Required: the code is delivered by SMS, and a marketing text without a
  // recorded opt-in is not one we are allowed to send.
  marketingConsent: z.literal(true),
});

export async function POST(req: Request) {
  const perIp = rateLimit(`welcome-ip:${ipFromRequest(req)}`, { max: 10, windowMs: 15 * 60_000 });
  if (!perIp.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const { phone, locale } = parsed.data;

  const perPhone = rateLimit(`welcome:${phone}`, { max: 3, windowMs: 60 * 60_000 });
  if (!perPhone.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const granted = grantWelcomeOffer(phone);
  if (!granted) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  // Record the opt-in against a customer so campaigns can reach them later.
  // Deliberately NOT upsertOnOrder: that increments order_count, and signing up
  // for an offer is not an order — it would corrupt the CRM's counts.
  try {
    const customer = registerMarketingOptIn({ phone, locale });
    addTag(customer.id, "sms-marketing");
    addTag(customer.id, "welcome-offer");
  } catch (e) {
    console.error("[welcome] could not record the opt-in", e);
  }

  const body =
    locale === "en"
      ? `Welcome to Diva Flowers. ${WELCOME_PERCENT}% off your first order of $75+ with the code ${granted.code} — good for 30 days.`
      : `Bienvenida a Diva Flowers. ${WELCOME_PERCENT}% en tu primer pedido de $75 o más con el código ${granted.code} — válido 30 días.`;

  try {
    if (twilioSmsEnabled() && !twilioDryRun()) {
      await sendSms(phone, `${body} ${OPT_OUT_FOOTER[locale]}`);
    } else {
      console.log(JSON.stringify({ event: "welcome_offer_dry_run", phone, code: granted.code }));
    }
  } catch (e) {
    console.error("[welcome] send failed", e);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
