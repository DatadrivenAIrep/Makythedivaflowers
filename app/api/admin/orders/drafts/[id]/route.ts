import { NextResponse } from "next/server";
import { draftRequestSchema } from "@/schemas/draft";
import { getDraft, saveDraft, deleteDraft } from "@/lib/draft-storage";
import type { DraftPayload } from "@/types/draft";

export const runtime = "nodejs";

const TAKEN_BY = "maky";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const draft = getDraft(id);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function PUT(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const existing = getDraft(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = draftRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const now = new Date().toISOString();
  const draft = saveDraft({
    id,
    label: parsed.data.label,
    payload: parsed.data.payload as unknown as DraftPayload,
    itemCount: parsed.data.itemCount,
    totalCents: parsed.data.totalCents,
    takenBy: existing.takenBy ?? TAKEN_BY,
    createdAt: existing.createdAt,
    updatedAt: now,
  });
  return NextResponse.json({ draft });
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  deleteDraft(id);
  return NextResponse.json({ ok: true });
}
