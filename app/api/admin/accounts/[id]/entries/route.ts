import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { recordCredit, recordAdjustment } from "@/lib/house-account-ledger";
import { getAccountDetail } from "@/lib/house-account-detail";
import { entryBody } from "@/schemas/house-account";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = entryBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { kind, amountCents, note } = parsed.data;
    const entry = kind === "credit"
      ? recordCredit({ accountId: id, amountCents, note, actor: "maky" }).entry
      : recordAdjustment({ accountId: id, amountCents, note, actor: "maky" });
    return NextResponse.json({ entry, detail: getAccountDetail(id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === "account_not_found" ? 404 : 400 });
  }
}
