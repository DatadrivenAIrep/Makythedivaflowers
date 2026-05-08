import { NextResponse } from "next/server";
import { isPrintAuthValid } from "@/lib/print-auth";
import { getQueueHealth } from "@/lib/print-queue";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (!isPrintAuthValid(auth)) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const health = await getQueueHealth();
  return NextResponse.json(health);
}
