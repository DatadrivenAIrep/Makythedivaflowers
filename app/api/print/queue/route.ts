import { NextResponse } from "next/server";
import { isPrintAuthValid } from "@/lib/print-auth";
import { claimPendingJobs, recoverStuckJobs } from "@/lib/print-queue";
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
  return NextResponse.json({ jobs });
}
