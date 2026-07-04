import { NextResponse } from "next/server";
import { acknowledge } from "@/lib/inquiry-storage-db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const detail = acknowledge(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail);
}
