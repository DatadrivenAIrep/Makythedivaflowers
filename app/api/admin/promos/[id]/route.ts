import { NextResponse } from "next/server";
import { z } from "zod";
import { getPromoById, setPromoActive } from "@/lib/promo";

export const runtime = "nodejs";

const patchSchema = z.object({ active: z.boolean() });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getPromoById(id)) {
    return NextResponse.json({ errors: { formErrors: ["not_found"] } }, { status: 404 });
  }
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  setPromoActive(id, parsed.data.active);
  return NextResponse.json({ promo: getPromoById(id) });
}
