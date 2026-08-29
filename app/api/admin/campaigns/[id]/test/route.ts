import { NextResponse } from "next/server";
import { SITE } from "@/data/site";
import { twilioSmsEnabled } from "@/lib/twilio-config";
import { getTwilioClient, sendSms } from "@/lib/twilio-server";
import { getCampaign } from "@/lib/campaign-storage";
import { renderCampaignBody } from "@/lib/campaign-sender";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const campaign = getCampaign(id);
    if (!campaign) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    if (!getTwilioClient()) return NextResponse.json({ ok: false, error: "no_credentials" });
    if (!twilioSmsEnabled()) return NextResponse.json({ ok: false, error: "sms_disabled" });

    const body = (await req.json().catch(() => null)) as { to?: unknown; locale?: unknown } | null;
    const raw = typeof body?.to === "string" ? body.to.trim() : "";
    let to: string = SITE.mobile.e164;
    if (raw) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return NextResponse.json({ ok: false, error: "invalid_number" });
      }
      to = raw;
    }
    const locale = body?.locale === "en" ? "en" : "es";
    const message = renderCampaignBody(campaign, { name: "Ana", locale });
    await sendSms(to, message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
