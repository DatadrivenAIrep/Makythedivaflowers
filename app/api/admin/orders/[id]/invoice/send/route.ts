import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrder } from "@/lib/order-storage";
import { sendInvoice, type InvoiceSendRequest } from "@/lib/invoice-sender";

export const runtime = "nodejs";

// Blank recipients mean "use the buyer on the order".
const blankToUndefined = (s: string) => (s === "" ? undefined : s);
const body = z.object({
  channel: z.enum(["sms", "email", "both"]),
  phone: z.string().trim().transform(blankToUndefined)
    .refine((s) => s === undefined || /^1?\d{10}$/.test(s.replace(/\D/g, "")), "invalid_phone")
    .optional(),
  email: z.string().trim().transform(blankToUndefined)
    .pipe(z.string().email().optional())
    .optional(),
});

/** Staff "Enviar factura": text and/or email the invoice to the customer. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const request: InvoiceSendRequest = { channel: parsed.data.channel };
  if (parsed.data.phone) request.phone = parsed.data.phone;
  if (parsed.data.email) request.email = parsed.data.email;
  const out = await sendInvoice(order, request);
  const anySent = out.sms?.status === "sent" || out.email?.status === "sent";
  return NextResponse.json(out, { status: anySent ? 200 : 502 });
}
