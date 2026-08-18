import { NextResponse } from "next/server";
import { SITE } from "@/data/site";
import { twilioSmsEnabled } from "@/lib/twilio-config";
import { getTwilioClient, sendSms } from "@/lib/twilio-server";

export const runtime = "nodejs";

// Sends ONE real SMS to the owner's mobile so the config can be verified.
// Deliberately calls sendSms directly, which bypasses the dry-run branch in
// sendMessage — a test that only simulates proves nothing. Guarded by proxy.ts
// (all /api/admin/* is admin-only).
export async function POST() {
  try {
    if (!getTwilioClient()) {
      return NextResponse.json({ ok: false, error: "no_credentials" });
    }
    if (!twilioSmsEnabled()) {
      return NextResponse.json({ ok: false, error: "sms_disabled" });
    }
    await sendSms(SITE.mobile.e164, "Diva Flowers — prueba de configuración ✓");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
