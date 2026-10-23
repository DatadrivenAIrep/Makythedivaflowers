import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { voidStatement } from "@/lib/house-account-statements";

export const runtime = "nodejs";
const body = z.object({ void: z.literal(true) });

export async function PATCH(req: Request, ctx: { params: Promise<{ sid: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sid } = await ctx.params;
  if (!body.safeParse(await req.json().catch(() => null)).success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    return NextResponse.json({ statement: voidStatement(sid) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "statement_not_found") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "statement_paid" || msg === "not_latest") return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
