import { NextResponse } from "next/server";
import { getAccount, updateAccount } from "@/lib/house-account-storage";
import { getAccountDetail } from "@/lib/house-account-detail";
import { skipStaleForAccount } from "@/lib/house-account-sends";
import { shopDateStr } from "@/lib/tv-slots";
import { accountPatch } from "@/schemas/house-account";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const detail = getAccountDetail(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const parsed = accountPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  const cur = getAccount(id);
  if (!cur) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const today = shopDateStr(new Date());
    const account = updateAccount(id, { ...parsed.data, billingEmail: parsed.data.billingEmail === "" ? "" : parsed.data.billingEmail }, today);
    // Coming back from a pause: anything that should have gone out meanwhile is skipped, not burst.
    if (cur.status !== "active" && account?.status === "active") skipStaleForAccount(id, today);
    return NextResponse.json({ account });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
