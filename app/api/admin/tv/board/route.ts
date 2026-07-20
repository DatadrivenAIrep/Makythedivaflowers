import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { buildTvBoard } from "@/lib/tv-board";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const board = await buildTvBoard();
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
}
