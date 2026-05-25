import { NextResponse } from "next/server";
import { z } from "zod";
import { changeFulfillmentStatus } from "@/lib/order-mutations";

export const runtime = "nodejs";

const body = z.object({
  status: z.enum(["preparing", "out-for-delivery", "delivered"]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const order = await changeFulfillmentStatus(id, parsed.data.status);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
