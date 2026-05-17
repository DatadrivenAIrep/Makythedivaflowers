import { NextResponse } from "next/server";
import { intakeSchema, type IntakeInput } from "@/schemas/intake";
import { PRODUCTS } from "@/data/products";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { computeOrderTotals, computeDeliveryCentsForZip } from "@/lib/totals";
import { saveOrder } from "@/lib/order-storage";
import { enqueuePrintJob } from "@/lib/print-queue";
import { upsertOnOrder } from "@/lib/customer-storage";
import type { Order, OrderFulfillment, CartLine } from "@/types/order";

export const runtime = "nodejs";

function computeTotals(input: IntakeInput): Order["totals"] {
  const subtotal = cartSubtotalCents(input.lines as CartLine[], PRODUCTS);
  let delivery = 0;
  if (input.fulfillment.method === "delivery") {
    delivery = computeDeliveryCentsForZip(input.fulfillment.address.zip) ?? 0;
  }
  const computed = computeOrderTotals(subtotal, delivery);
  return {
    subtotalCents: input.totalsOverride?.subtotalCents ?? computed.subtotalCents,
    deliveryCents: input.totalsOverride?.deliveryCents ?? computed.deliveryCents,
    taxCents: input.totalsOverride?.taxCents ?? computed.taxCents,
    totalCents: input.totalsOverride?.totalCents ?? computed.totalCents,
  };
}

function newId(): string {
  return `do_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = intakeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const now = new Date().toISOString();

  const customer = upsertOnOrder({
    name: input.customer.name,
    phone: input.customer.phone,
    email: input.customer.email && input.customer.email !== "" ? input.customer.email : undefined,
    address:
      input.fulfillment.method === "delivery" ? input.fulfillment.address : undefined,
    orderAt: now,
  });

  const fulfillment: OrderFulfillment = input.fulfillment;
  const order: Order = {
    id: newId(),
    source: input.source,
    locale: "en",
    customerId: customer.id,
    lines: input.lines as CartLine[],
    fulfillment,
    contact: {
      email: input.customer.email && input.customer.email !== "" ? input.customer.email : undefined,
      phone: input.customer.phone,
    },
    totals: computeTotals(input),
    status: "pending",
    paymentStatus: input.payment.status,
    paymentMethod: input.payment.status === "paid" ? input.payment.method : undefined,
    paidAt: input.payment.status === "paid" ? now : undefined,
    takenBy: "maky",
    internalNotes: input.internalNotes,
    createdAt: now,
    updatedAt: now,
  };

  await saveOrder(order);
  const job = await enqueuePrintJob(order);

  // Fire-and-forget email when the order is paid AND there's an email on file.
  // Phase 1 reuses `notifyOrderPaid` from the existing web pipeline.
  // Pending-payment orders do not send email here.
  if (order.paymentStatus === "paid" && order.contact.email) {
    import("@/lib/order-notifications")
      .then(({ notifyOrderPaid }) => notifyOrderPaid(order))
      .catch((e) => console.error(JSON.stringify({ event: "intake_email_failed", error: String(e) })));
  }

  return NextResponse.json({ orderId: order.id, printJobId: job.id }, { status: 201 });
}
