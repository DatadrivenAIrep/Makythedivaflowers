import { NextResponse } from "next/server";
import { z } from "zod";
import { issueLoginCode } from "@/lib/customer-auth";
import { sendSms } from "@/lib/twilio-server";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().min(10, "phone_too_short").max(15)),
});

/** Identical for every caller: this must not reveal who shops here. */
const GENERIC_OK = { ok: true } as const;

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }
  const phone = parsed.data.phone;

  // Two limits: one so a single number cannot be used to send someone repeated
  // texts, one so a script cannot walk a range of numbers from one address.
  const perPhone = rateLimit(`account-code:${phone}`, { max: 3, windowMs: 15 * 60_000 });
  const perIp = rateLimit(`account-code-ip:${ipFromRequest(req)}`, { max: 10, windowMs: 15 * 60_000 });
  if (!perPhone.ok || !perIp.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const issued = issueLoginCode(phone);
  // Unknown number: answer exactly as for a known one and send nothing.
  if (!issued) return NextResponse.json(GENERIC_OK);

  const body = `${issued.code} — tu código de acceso de Diva Flowers. Vence en 10 minutos.`;
  try {
    if (twilioSmsEnabled() && !twilioDryRun()) await sendSms(phone, body);
    else console.log(JSON.stringify({ event: "account_code_dry_run", phone }));
  } catch (e) {
    // Still a generic answer: a delivery failure must not tell the caller
    // whether the number is on file.
    console.error("[account] code send failed", e);
  }
  return NextResponse.json(GENERIC_OK);
}
