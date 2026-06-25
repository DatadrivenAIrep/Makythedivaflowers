import { NextResponse } from "next/server";
import { intakeSchema, type IntakeInput } from "@/schemas/intake";
import { resolveOrderTotals } from "@/lib/totals";
import { saveOrder, listOrders, type ListOrdersFilters } from "@/lib/order-storage";
import { enqueuePrintJob } from "@/lib/print-queue";
import { upsertOnOrder } from "@/lib/customer-storage";
import { createCheckoutSession } from "@/lib/stripe-payment-link";
import { dispatchOrderReceived } from "@/lib/order-dispatch";
import { validateForRedemption, redeem } from "@/lib/gift-card-storage";
import type { Order, OrderFulfillment, CartLine } from "@/types/order";

export const runtime = "nodejs";

function computeTotals(input: IntakeInput): Order["totals"] {
  return resolveOrderTotals({
    lines: input.lines as CartLine[],
    fulfillmentMethod: input.fulfillment.method,
    address: input.fulfillment.method === "delivery" ? input.fulfillment.address : undefined,
    override: input.totalsOverride,
  });
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
    messagingChannel: input.customer.messagingChannel,
    locale: input.customer.locale,
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
      name: input.customer.name && input.customer.name !== "" ? input.customer.name : undefined,
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

  let giftCardId: string | undefined;
  let giftCardCents = 0;
  if (input.giftCardCode) {
    const check = validateForRedemption(input.giftCardCode, order.totals.totalCents);
    if (!check.ok) {
      return NextResponse.json({ errors: { formErrors: ["gift_card_invalid"] } }, { status: 400 });
    }
    giftCardId = check.card.id;
    giftCardCents = check.applicableCents;
    order.giftCardId = giftCardId;
    order.giftCardCents = giftCardCents || undefined;
    // Full coverage → mark paid by gift card regardless of the chosen method.
    if (order.totals.totalCents - giftCardCents <= 0) {
      order.paymentStatus = "paid";
      order.paymentMethod = "gift-card";
      order.paidAt = now;
    }
  }

  // Freeze how much was collected at creation, so a later edit can surface a balance.
  if (order.paymentStatus === "paid") {
    order.amountPaidCents = order.totals.totalCents;
  }

  await saveOrder(order);

  {
    const { recordOrderChange } = await import("@/lib/order-history");
    await recordOrderChange({
      orderId: order.id, actor: order.takenBy ?? "maky", kind: "created",
      summary: `Orden creada · ${order.source}`,
    });
  }

  if (giftCardId && order.paymentStatus === "paid") {
    try {
      redeem(giftCardId, order.id, giftCardCents);
    } catch (e) {
      console.error("[gift-card] intake redeem failed for order", order.id, e);
    }
  }

  const job = await enqueuePrintJob(order);

  // Generate a Stripe Checkout Session for pending orders that will be messaged
  // via SMS or WhatsApp. Skip when the customer prefers email/none — they pay
  // through the existing email flow or manually.
  let paymentLinkUrl: string | undefined;
  const channel = customer.messagingChannel ?? "sms";
  const shouldCreateLink =
    order.paymentStatus === "pending" &&
    (channel === "sms" || channel === "whatsapp");

  if (shouldCreateLink) {
    try {
      const session = await createCheckoutSession(order, customer.locale ?? order.locale);
      paymentLinkUrl = session.url;
      order.stripeCheckoutSessionId = session.id;
    } catch (e) {
      console.error(
        JSON.stringify({ event: "checkout_session_failed", orderId: order.id, error: String(e) }),
      );
    }
  }

  // Dispatch the right message. order_received OR payment_link is chosen
  // internally by dispatchOrderReceived based on order.paymentStatus + link presence.
  await dispatchOrderReceived(order, paymentLinkUrl);

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

function parseList(sp: URLSearchParams, key: string): string[] | undefined {
  const values = sp.getAll(key);
  if (values.length === 0) return undefined;
  // Support both ?key=a&key=b and ?key=a,b
  return values.flatMap((v) => v.split(",")).map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const filters: ListOrdersFilters = {
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    paymentStatus: parseList(sp, "paymentStatus"),
    fulfillmentStatus: parseList(sp, "fulfillmentStatus"),
    source: parseList(sp, "source"),
    fulfillmentMethod: parseList(sp, "fulfillmentMethod"),
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    cursor: sp.get("cursor") ?? undefined,
  };
  const result = await listOrders(filters);
  return NextResponse.json(result);
}
