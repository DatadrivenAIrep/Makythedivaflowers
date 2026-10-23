import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAccount } from "@/lib/house-account-storage";
import { issueStatement } from "@/lib/house-account-statements";
import { shopDateStr } from "@/lib/tv-slots";

export const runtime = "nodejs";

/** "Emitir estado ahora": closes the period through today. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!getAccount(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const today = shopDateStr(new Date());
  const statement = issueStatement(id, today, { today });
  return NextResponse.json({ statement }, { status: statement ? 201 : 200 });
}
