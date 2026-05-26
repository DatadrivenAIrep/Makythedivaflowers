import { NextResponse } from "next/server";
import { z } from "zod";
import { appendInternalNote } from "@/lib/order-mutations";

export const runtime = "nodejs";

const body = z.object({ text: z.string().max(2000) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const order = await appendInternalNote(id, parsed.data.text, "maky");
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
