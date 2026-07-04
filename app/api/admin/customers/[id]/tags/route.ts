import { NextResponse } from "next/server";
import { addTag, getCustomerById, normalizeTag, removeTag } from "@/lib/customer-storage";
import { tagBodySchema } from "@/schemas/customer-patch";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function parseTag(req: Request): Promise<string | null> {
  const json = await req.json().catch(() => null);
  const parsed = tagBodySchema.safeParse(json);
  if (!parsed.success) return null;
  return normalizeTag(parsed.data.tag);
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const tag = await parseTag(req);
  if (!tag) return NextResponse.json({ error: "invalid_tag" }, { status: 400 });
  return NextResponse.json({ tags: addTag(id, tag) });
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const tag = await parseTag(req);
  if (!tag) return NextResponse.json({ error: "invalid_tag" }, { status: 400 });
  return NextResponse.json({ tags: removeTag(id, tag) });
}
