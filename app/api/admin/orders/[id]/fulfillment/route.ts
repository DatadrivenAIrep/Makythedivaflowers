import { NextResponse } from "next/server";
import { z } from "zod";
import { changeFulfillmentStatus } from "@/lib/order-mutations";
import { getOrder } from "@/lib/order-storage";
import { deleteDeliveryPhoto } from "@/lib/delivery-photos";

export const runtime = "nodejs";

const body = z.object({
  status: z.enum(["preparing", "out-for-delivery", "delivered"]),
  /** `false` = staff chose "Entregar sin foto": drop any stored photo before delivering. */
  photo: z.literal(false).optional(),
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
    if (parsed.data.status === "delivered") {
      const existing = await getOrder(id);
      // Idempotent retry (e.g. the first response was lost): change and delete nothing.
      if (existing?.status === "delivered") return NextResponse.json({ order: existing });
      if (existing && parsed.data.photo === false) deleteDeliveryPhoto(id);
    }
    const order = await changeFulfillmentStatus(id, parsed.data.status);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
