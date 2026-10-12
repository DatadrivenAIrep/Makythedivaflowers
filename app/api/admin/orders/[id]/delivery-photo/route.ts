import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrder } from "@/lib/order-storage";
import { saveDeliveryPhoto, deliveryPhotoPath, MAX_DELIVERY_PHOTO_BYTES } from "@/lib/delivery-photos";

export const runtime = "nodejs";

function dim(v: FormDataEntryValue | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  // proxy.ts gates /api/admin/*; re-check like the product-images upload does.
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (order.fulfillment.method !== "delivery")
    return NextResponse.json({ error: "not_delivery" }, { status: 400 });
  if (order.status === "delivered" || order.status === "canceled")
    return NextResponse.json({ error: "already_delivered" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (file.size > MAX_DELIVERY_PHOTO_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const result = saveDeliveryPhoto(id, Buffer.from(await file.arrayBuffer()), {
    width: dim(form?.get("width")),
    height: dim(form?.get("height")),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "too_large" ? 413 : 400 });
  }
  return NextResponse.json({ token: result.token, url: deliveryPhotoPath(result.token) });
}
