import { NextResponse } from "next/server";
import { draftRequestSchema } from "@/schemas/draft";
import { listDrafts, saveDraft } from "@/lib/draft-storage";
import type { DraftPayload } from "@/types/draft";

export const runtime = "nodejs";

const TAKEN_BY = "maky"; // matches the intake create route; real auth is a follow-up

function newId(): string {
  return `dr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ drafts: listDrafts() });
}

export async function POST(req: Request): Promise<Response> {
  const json = await req.json().catch(() => null);
  const parsed = draftRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const now = new Date().toISOString();
  const draft = saveDraft({
    id: newId(),
    label: parsed.data.label,
    payload: parsed.data.payload as unknown as DraftPayload,
    itemCount: parsed.data.itemCount,
    totalCents: parsed.data.totalCents,
    takenBy: TAKEN_BY,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ id: draft.id, draft }, { status: 201 });
}
