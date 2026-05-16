import { NextResponse } from "next/server";
import { isPrintAuthValid } from "@/lib/print-auth";
import { ackJob, claimPendingJobs, recoverStuckJobs } from "@/lib/print-queue";
import { getOrder } from "@/lib/order-storage";
import { buildSheetHtml } from "@/lib/print-render-html";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const STUCK_TIMEOUT_MS = 5 * 60_000;
const CLAIM_LIMIT = 5;

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!isPrintAuthValid(auth)) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const rl = rateLimit("print:queue", { max: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return new NextResponse("rate limited", { status: 429 });
  }
  await recoverStuckJobs(STUCK_TIMEOUT_MS);
  const jobs = await claimPendingJobs(CLAIM_LIMIT);

  // For each claimed job, hydrate it with the order's rendered HTML so the
  // agent can render PDF locally. If the order no longer exists or HTML
  // building fails, mark the job failed and skip it.
  const hydrated: Array<{
    id: string;
    orderId: string;
    html: string;
  }> = [];
  for (const job of jobs) {
    try {
      const order = await getOrder(job.orderId);
      if (!order) {
        await ackJob(job.id, "failed", `order ${job.orderId} not found`);
        continue;
      }
      hydrated.push({
        id: job.id,
        orderId: job.orderId,
        html: await buildSheetHtml(order),
      });
    } catch (e) {
      const errMsg = (e as Error).message ?? String(e);
      console.error("[print] hydrate failed for job", job.id, errMsg);
      await ackJob(job.id, "failed", `hydrate failed: ${errMsg}`);
    }
  }

  return NextResponse.json({ jobs: hydrated });
}
