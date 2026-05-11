import { NextResponse } from "next/server";
import { z } from "zod";
import { isPrintAuthValid } from "@/lib/print-auth";
import { ackJob, __readAll } from "@/lib/print-queue";
import { notifyPrintFailed } from "@/lib/order-notifications";

export const runtime = "nodejs";

const bodySchema = z.object({
  status: z.enum(["printed", "failed"]),
  error: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Next.js 16 wraps dynamic-segment params in a Promise.
  const auth = req.headers.get("authorization");
  if (!isPrintAuthValid(auth)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return new NextResponse("bad body", { status: 400 });
  }

  const { id } = await ctx.params;
  const all = await __readAll();
  const job = all.find((j) => j.id === id);
  if (!job) {
    return new NextResponse("not found", { status: 404 });
  }

  await ackJob(id, parsed.data.status, parsed.data.error);

  if (parsed.data.status === "failed") {
    void notifyPrintFailed(job.orderId, parsed.data.error ?? "unknown");
  }

  return NextResponse.json({ ok: true });
}
