import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerById } from "@/lib/customer-storage";
import { listDatesFor } from "@/lib/customer-dates-storage";
import { setDatePreferences } from "@/lib/date-preferences-storage";
import { dateRewardsEnabled } from "@/lib/date-rewards-flags";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; dateId: string }> };

const bodySchema = z.object({
  flowers: z.array(z.string()),
  colors: z.array(z.string()),
  avoid: z.array(z.string()),
});

/** Staff edit of what a person likes. Never touches stamps: no claimBonus here. */
export async function PUT(req: Request, { params }: Ctx): Promise<Response> {
  if (!dateRewardsEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { id, dateId } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!listDatesFor(id).some((d) => d.id === dateId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  // Unknown codes are dropped and flowers/colors capped inside setDatePreferences.
  const prefs = setDatePreferences(dateId, parsed.data as Parameters<typeof setDatePreferences>[1]);
  return NextResponse.json({ prefs });
}
