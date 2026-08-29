import { NextResponse } from "next/server";
import { SITE } from "@/data/site";
import { twilioSmsEnabled } from "@/lib/twilio-config";
import { getTwilioClient, sendSms } from "@/lib/twilio-server";
import { renderSmsBody, type TemplateVars } from "@/lib/messaging-templates";
import type { MessageTemplate } from "@/lib/message-storage";

export const runtime = "nodejs";

// The customer-facing templates that can be previewed via a real test send.
const KNOWN_TEMPLATES: MessageTemplate[] = [
  "order_received",
  "payment_link",
  "payment_confirmed",
  "out_for_delivery",
  "delivered",
];

// Sample values so the previewed template reads like a real message.
function sampleVars(locale: "en" | "es"): TemplateVars {
  return {
    recipient_name: "Maria",
    total: "$89.50",
    window: locale === "es" ? "jue 21 ago · mañana (9–12)" : "Thu Aug 21 · morning (9–12)",
    link: "https://buy.stripe.com/test_sample",
    shop_phone: SITE.phoneDisplay,
    order_number: "1042",
  };
}

// Sends ONE real SMS to verify config or preview a template. `to` defaults to
// the owner's mobile; `template` (a known customer template) + `locale` render a
// realistic sample, otherwise a plain config-check message is sent. Calls sendSms
// directly (bypasses the dry-run branch). Guarded by proxy.ts (admin-only).
export async function POST(req: Request) {
  try {
    if (!getTwilioClient()) {
      return NextResponse.json({ ok: false, error: "no_credentials" });
    }
    if (!twilioSmsEnabled()) {
      return NextResponse.json({ ok: false, error: "sms_disabled" });
    }
    const body = (await req.json().catch(() => null)) as
      | { to?: unknown; template?: unknown; locale?: unknown }
      | null;

    const raw = typeof body?.to === "string" ? body.to.trim() : "";
    let to: string = SITE.mobile.e164;
    if (raw) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return NextResponse.json({ ok: false, error: "invalid_number" });
      }
      to = raw; // sendSms normalizes to E.164
    }

    const template = typeof body?.template === "string" ? body.template : "";
    const locale = body?.locale === "en" ? "en" : "es";
    const message = KNOWN_TEMPLATES.includes(template as MessageTemplate)
      ? renderSmsBody(template as MessageTemplate, locale, sampleVars(locale))
      : "Diva Flowers — prueba de configuración ✓";

    await sendSms(to, message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
