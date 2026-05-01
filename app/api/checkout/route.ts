import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSchema } from "@/schemas/checkout";
import { computeOrderTotals } from "@/lib/totals";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { PRODUCTS } from "@/data/products";
import { saveOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";
import type { CartLine } from "@/lib/cart-store";

const cartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  addOnIds: z.array(z.string()),
  qty: z.number().int().min(1).max(99),
});

const requestSchema = z.object({
  locale: z.enum(["en", "es"]),
  lines: z.array(cartLineSchema).min(1, "cart_empty"),
  form: checkoutSchema,
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }
  const { locale, lines, form } = parsed.data;
  const subtotal = cartSubtotalCents(lines as CartLine[], PRODUCTS);
  if (subtotal <= 0) {
    return NextResponse.json({ ok: false, errors: { formErrors: ["cart_empty"] } }, { status: 400 });
  }
  const totals = computeOrderTotals(subtotal);

  await new Promise((r) => setTimeout(r, 800));

  const id = `do_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const order: Order = {
    id,
    locale,
    lines: lines as CartLine[],
    delivery: {
      recipient: form.delivery.recipient,
      address: form.delivery.address,
      window: form.delivery.window,
      cardMessage: form.delivery.cardMessage || undefined,
    },
    contact: form.contact,
    totals,
    status: "paid",
    createdAt: new Date().toISOString(),
  };
  await saveOrder(order);

  return NextResponse.json({ ok: true, id }, { status: 200 });
}
