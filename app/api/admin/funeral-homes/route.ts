import { NextResponse } from "next/server";
import { z } from "zod";
import { addFuneralHome, listFuneralHomes, recentFuneralAddresses, removeFuneralHome } from "@/lib/funeral-homes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const address = z.object({
  street1: z.string().trim().min(3).max(120),
  street2: z.string().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.literal("US"),
});
const createBody = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().max(20).optional(), address });
const deleteBody = z.object({ id: z.string().min(1) });

function snapshot() {
  return { homes: listFuneralHomes(), recent: recentFuneralAddresses() };
}

export async function GET(): Promise<Response> {
  return NextResponse.json(snapshot());
}

export async function POST(req: Request): Promise<Response> {
  const parsed = createBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { street2, ...rest } = parsed.data.address;
  addFuneralHome({ ...parsed.data, address: { ...rest, ...(street2?.trim() ? { street2: street2.trim() } : {}) } });
  return NextResponse.json(snapshot(), { status: 201 });
}

export async function DELETE(req: Request): Promise<Response> {
  const parsed = deleteBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  removeFuneralHome(parsed.data.id);
  return NextResponse.json(snapshot());
}
