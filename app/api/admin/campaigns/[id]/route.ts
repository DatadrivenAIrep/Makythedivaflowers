import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/campaign-storage";
import { renderCampaignBody, smsSegments } from "@/lib/campaign-sender";
import { listMarketingRecipients } from "@/lib/customer-storage";

export const runtime = "nodejs";

const SAMPLE_NAME = "Ana";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const campaign = getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const previewEs = renderCampaignBody(campaign, { name: SAMPLE_NAME, locale: "es" });
  const previewEn = renderCampaignBody(campaign, { name: SAMPLE_NAME, locale: "en" });
  return NextResponse.json({
    campaign,
    recipientCount: listMarketingRecipients(campaign.segment).length,
    previewEs,
    previewEn,
    segmentsEs: smsSegments(previewEs),
    segmentsEn: smsSegments(previewEn),
  });
}
