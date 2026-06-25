import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { buildSheetHtml } from "@/lib/print-render-html";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const html = await buildSheetHtml(order);
  return new NextResponse(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
