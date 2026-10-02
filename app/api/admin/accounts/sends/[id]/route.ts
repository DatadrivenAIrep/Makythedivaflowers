import { NextResponse } from "next/server";
import { getSend, markSkipped, rescheduleSend } from "@/lib/house-account-sends";
import { dispatchSend } from "@/lib/house-account-sender";
import { shopDateStr } from "@/lib/tv-slots";
import { sendPatch } from "@/schemas/house-account";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const parsed = sendPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const row = getSend(id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status !== "scheduled") return NextResponse.json({ error: "not_scheduled" }, { status: 409 });
  const today = shopDateStr(new Date());
  const data = parsed.data;
  if ("skip" in data) {
    markSkipped(id, "manual");
    return NextResponse.json({ send: getSend(id) });
  }
  if ("scheduledFor" in data) {
    // The regex only checks the shape; a real calendar day round-trips unchanged (2026-13-45 does not).
    const d = new Date(data.scheduledFor + "T12:00:00Z");
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== data.scheduledFor) {
      return NextResponse.json({ error: "date_invalid" }, { status: 400 });
    }
    if (data.scheduledFor < today) return NextResponse.json({ error: "date_in_past" }, { status: 400 });
    return NextResponse.json({ send: rescheduleSend(id, data.scheduledFor) });
  }
  return NextResponse.json({ send: await dispatchSend(row, today) });
}
