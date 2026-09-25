import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getByOrder } from "@/lib/digital-cards";
import { qrPng } from "@/lib/digital-card-qr";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const card = getByOrder(id);
  if (!card) return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  const png = await qrPng(card.shortUrl);
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="tarjeta-${id}.png"`,
      "cache-control": "no-store",
    },
  });
}
