import { NextResponse } from "next/server";
import { z } from "zod";
import { createDraft, listCampaigns } from "@/lib/campaign-storage";
import { listMarketingRecipients } from "@/lib/customer-storage";

export const runtime = "nodejs";

const SEGMENT = "sms-marketing";

const createBody = z.object({
  bodyEs: z.string().trim().min(1).max(1000),
  bodyEn: z.string().max(1000).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const json = await req.json().catch(() => null);
  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const campaign = createDraft({ bodyEs: parsed.data.bodyEs, bodyEn: parsed.data.bodyEn ?? "" });
  const recipientCount = listMarketingRecipients(SEGMENT).length;
  return NextResponse.json({ campaign, recipientCount });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ campaigns: listCampaigns() });
}
