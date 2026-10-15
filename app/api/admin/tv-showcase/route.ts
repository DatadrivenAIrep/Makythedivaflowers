import { NextResponse } from "next/server";
import { z } from "zod";
import { setTvVisibility } from "@/lib/tv-showcase-storage";
import { PRODUCTS } from "@/data/products";

export const runtime = "nodejs";

const putSchema = z.object({
  productId: z.string().min(1),
  visible: z.boolean(),
});

// /vitrina is force-dynamic and reloads itself, so nothing to revalidate here.
export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });

  const { productId, visible } = parsed.data;
  if (!PRODUCTS.some((p) => p.id === productId))
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });

  setTvVisibility(productId, visible);
  return NextResponse.json({ ok: true });
}
