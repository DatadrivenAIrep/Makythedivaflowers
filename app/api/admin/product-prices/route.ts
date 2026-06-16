import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAllPriceOverrides,
  setPriceOverride,
  deletePriceOverride,
} from "@/lib/product-prices";
import { PRODUCTS } from "@/data/products";

export const runtime = "nodejs";

// Guard: productId + variantId must exist in the static catalog.
function isValidVariant(productId: string, variantId: string): boolean {
  const p = PRODUCTS.find((p) => p.id === productId);
  return !!p?.variants.find((v) => v.id === variantId);
}

const putSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  priceCents: z.number().int().min(0),
});

const deleteSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
});

export async function GET() {
  return NextResponse.json({ overrides: getAllPriceOverrides() });
}

export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });

  const { productId, variantId, priceCents } = parsed.data;
  if (!isValidVariant(productId, variantId))
    return NextResponse.json({ error: "variant_not_found" }, { status: 404 });

  setPriceOverride(productId, variantId, priceCents);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });

  const { productId, variantId } = parsed.data;
  if (!isValidVariant(productId, variantId))
    return NextResponse.json({ error: "variant_not_found" }, { status: 404 });

  deletePriceOverride(productId, variantId);
  return NextResponse.json({ ok: true });
}
