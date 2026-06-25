import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { enqueuePrintJob } from "@/lib/print-queue";
import { recordOrderChange } from "@/lib/order-history";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const job = await enqueuePrintJob(order);
  await recordOrderChange({ orderId: id, actor: "maky", kind: "reprint", summary: "Reimpresa" });
  return NextResponse.json({ jobId: job.id });
}
