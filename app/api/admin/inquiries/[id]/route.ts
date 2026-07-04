import { NextResponse } from "next/server";
import {
  changeStage, getInquiry, markLost, setFollowUp, updateNotes,
} from "@/lib/inquiry-storage-db";
import { inquiryPatchSchema } from "@/schemas/inquiry-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const ACTOR = "maky";

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const detail = getInquiry(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getInquiry(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = inquiryPatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  const p = parsed.data;

  let result = getInquiry(id);
  if (p.lost) result = markLost(id, p.lost.reason, ACTOR);
  if (p.stage) result = changeStage(id, p.stage, ACTOR);
  if (p.notes !== undefined) result = updateNotes(id, p.notes, ACTOR);
  if (p.followUpDate !== undefined) result = setFollowUp(id, p.followUpDate, ACTOR);

  return NextResponse.json(result);
}
