import { NextResponse } from "next/server";
import { z } from "zod";
import { getCampaign, updateDraft, type Campaign } from "@/lib/campaign-storage";
import { renderCampaignBody, smsSegments } from "@/lib/campaign-sender";
import { listMarketingRecipients } from "@/lib/customer-storage";

export const runtime = "nodejs";

const SAMPLE_NAME = "Ana";

// The enriched detail payload: the campaign plus its rendered ES/EN previews (with
// the opt-out footer already appended), each preview's SMS-segment count, and the
// live opted-in recipient count. Shared by GET and PATCH so the client refreshes
// the preview from either response.
function detail(campaign: Campaign) {
  const previewEs = renderCampaignBody(campaign, { name: SAMPLE_NAME, locale: "es" });
  const previewEn = renderCampaignBody(campaign, { name: SAMPLE_NAME, locale: "en" });
  return {
    campaign,
    recipientCount: listMarketingRecipients(campaign.segment).length,
    previewEs,
    previewEn,
    segmentsEs: smsSegments(previewEs),
    segmentsEn: smsSegments(previewEn),
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const campaign = getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail(campaign));
}

const patchBody = z.object({
  bodyEs: z.string().trim().min(1).max(1000),
  bodyEn: z.string().max(1000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const updated = updateDraft(id, { bodyEs: parsed.data.bodyEs, bodyEn: parsed.data.bodyEn ?? "" });
  // null = not found, or already sending/sent (only drafts are editable).
  if (!updated) return NextResponse.json({ error: "not_draft" }, { status: 409 });
  return NextResponse.json(detail(updated));
}
