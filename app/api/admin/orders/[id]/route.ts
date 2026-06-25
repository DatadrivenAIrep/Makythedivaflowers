import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrder } from "@/lib/order-storage";
import { getDb } from "@/lib/db";
import { recentMessagesForOrder } from "@/lib/message-storage";
import { listOrderHistory } from "@/lib/order-history";
import { orderBalanceCents } from "@/lib/order-balance";
import { editOrder, type OrderEditPatch } from "@/lib/order-edit";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const customer = order.customerId
    ? getDb().prepare("SELECT * FROM customers WHERE id = ?").get(order.customerId)
    : null;
  const messages = recentMessagesForOrder(id, 50);
  const history = await listOrderHistory(id);
  return NextResponse.json({ order, customer, messages, history, balanceCents: orderBalanceCents(order) });
}

const addressSchema = z.object({
  street1: z.string(), street2: z.string().optional(),
  city: z.string(), state: z.string(), zip: z.string(), country: z.literal("US"),
});
const recipientSchema = z.object({ name: z.string().optional(), phone: z.string().optional() });
const windowSchema = z.object({ date: z.string(), slot: z.enum(["morning", "midday", "afternoon", "evening"]) });
const lineSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("catalog"), productId: z.string(), variantId: z.string(), addOnIds: z.array(z.string()), qty: z.number().int().positive() }),
  z.object({ kind: z.literal("custom"), title: z.string(), priceCents: z.number().int().nonnegative(), designerNotes: z.string().optional(), qty: z.number().int().positive() }),
]);
const totalsOverrideSchema = z.object({
  subtotalCents: z.number().int().nonnegative().optional(),
  deliveryCents: z.number().int().nonnegative().optional(),
  taxCents: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative().optional(),
});
const patchSchema = z.object({
  contact: z.object({ name: z.string().optional(), email: z.string().optional(), phone: z.string().optional() }).optional(),
  recipient: recipientSchema.optional(),
  fulfillmentMethod: z.enum(["in-store", "delivery", "pickup"]).optional(),
  address: addressSchema.optional(),
  window: windowSchema.optional(),
  cardMessage: z.string().optional(),
  lines: z.array(lineSchema).optional(),
  totalsOverride: totalsOverrideSchema.optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const { order, change } = await editOrder(id, parsed.data as OrderEditPatch, "maky");
    return NextResponse.json({ order, change });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
