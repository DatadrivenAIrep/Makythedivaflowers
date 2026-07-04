import { NextResponse } from "next/server";
import { getCustomerById } from "@/lib/customer-storage";
import {
  addPreference,
  normalizePreference,
  removePreference,
} from "@/lib/customer-dates-storage";
import type { PreferenceKind } from "@/lib/customer-dates";
import { preferenceBodySchema } from "@/schemas/customer-dates";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function parseBody(req: Request): Promise<{ kind: PreferenceKind; value: string } | null> {
  const json = await req.json().catch(() => null);
  const parsed = preferenceBodySchema.safeParse(json);
  if (!parsed.success) return null;
  const value = normalizePreference(parsed.data.value);
  if (!value) return null;
  return { kind: parsed.data.kind, value };
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await parseBody(req);
  if (!body) return NextResponse.json({ error: "invalid_preference" }, { status: 400 });
  return NextResponse.json({ preferences: addPreference(id, body.kind, body.value) });
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await parseBody(req);
  if (!body) return NextResponse.json({ error: "invalid_preference" }, { status: 400 });
  return NextResponse.json({ preferences: removePreference(id, body.kind, body.value) });
}
