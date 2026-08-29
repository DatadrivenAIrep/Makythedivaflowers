import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/campaign-storage";
import { sendCampaign } from "@/lib/campaign-sender";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!getCampaign(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const tally = await sendCampaign(id);
  return NextResponse.json({ ok: true, ...tally });
}
