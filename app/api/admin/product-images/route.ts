import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/admin-auth";
import { setImageOverride, deleteImageOverride, getAllImageOverrides } from "@/lib/product-images";
import { PRODUCTS } from "@/data/products";
import fs from "node:fs";
import path from "node:path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function productExists(id: string) {
  return PRODUCTS.some((p) => p.id === id);
}

export async function POST(req: NextRequest) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (!verifySession(token)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const productId = form.get("productId");
  const file = form.get("file");

  if (typeof productId !== "string" || !productId)
    return NextResponse.json({ error: "missing_product_id" }, { status: 400 });
  if (!productExists(productId))
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  if (!(file instanceof File))
    return NextResponse.json({ error: "missing_file" }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  // Delete the old custom file if one exists
  const current = getAllImageOverrides().find((o) => o.productId === productId);
  if (current) {
    const oldFile = path.join(process.cwd(), "public", current.src);
    try { fs.unlinkSync(oldFile); } catch {}
  }

  const filename = `${productId}-custom-${Date.now()}.${ext}`;
  const dest = path.join(process.cwd(), "public", "products", filename);
  fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));

  const src = `/products/${filename}`;
  setImageOverride(productId, src);

  return NextResponse.json({ src });
}

export async function DELETE(req: NextRequest) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (!verifySession(token)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { productId } = await req.json() as { productId: string };
  if (!productExists(productId))
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });

  const current = getAllImageOverrides().find((o) => o.productId === productId);
  if (current) {
    const oldFile = path.join(process.cwd(), "public", current.src);
    try { fs.unlinkSync(oldFile); } catch {}
    deleteImageOverride(productId);
  }

  return NextResponse.json({ ok: true });
}
