import { NextResponse } from "next/server";
import { SITE } from "@/data/site";
import { twilioSmsEnabled } from "@/lib/twilio-config";
import { getTwilioClient, sendSms } from "@/lib/twilio-server";

export const runtime = "nodejs";

// Sends ONE real SMS to verify the config. Target defaults to the owner's mobile,
// but the admin can pass `to` in the body to test another number. Calls sendSms
// directly (bypasses the dry-run branch) — a simulated test proves nothing.
// Guarded by proxy.ts (all /api/admin/* is admin-only).
export async function POST(req: Request) {
  try {
    if (!getTwilioClient()) {
      return NextResponse.json({ ok: false, error: "no_credentials" });
    }
    if (!twilioSmsEnabled()) {
      return NextResponse.json({ ok: false, error: "sms_disabled" });
    }
    const body = (await req.json().catch(() => null)) as { to?: unknown } | null;
    const raw = typeof body?.to === "string" ? body.to.trim() : "";
    let to: string = SITE.mobile.e164;
    if (raw) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return NextResponse.json({ ok: false, error: "invalid_number" });
      }
      to = raw; // sendSms normalizes to E.164
    }
    await sendSms(to, "Diva Flowers — prueba de configuración ✓");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
