import "server-only";
import { upsertOnOrder, addTag } from "@/lib/customer-storage";
import { getOrder, updateOrder } from "@/lib/order-storage";
import { dispatchPaymentConfirmed } from "@/lib/order-dispatch";
import type { Order } from "@/types/order";

/** The buyer names the customer record. Web checkout lets the buyer leave their
 *  own name blank, in which case the recipient is the only name we have. */
function buyerName(order: Order): string {
  const fromContact = order.contact.name?.trim();
  if (fromContact) return fromContact;
  return order.fulfillment.recipient.name.trim();
}

/**
 * Side effects owed to the customer once a web order is actually paid: put them
 * in the CRM, link the order to them, then confirm by SMS.
 *
 * Takes an id rather than an Order on purpose. Callers hold order snapshots read
 * *before* the payment was recorded, and this function writes the order back —
 * passing a stale object would stamp `paymentStatus: "pending"` over a paid row.
 *
 * Never throws. Both call sites are payment paths: the Stripe webhook must return
 * 200 or Stripe retries it, re-running the shop email and the print job.
 */
export async function onWebOrderPaid(orderId: string): Promise<void> {
  try {
    const order = await getOrder(orderId);
    if (!order) return;
    // Idempotency: Stripe retries webhooks, and upsertOnOrder increments
    // order_count on every call. The link is the guard.
    if (order.customerId) return;

    const customer = upsertOnOrder({
      name: buyerName(order),
      phone: order.contact.phone,
      email: order.contact.email || undefined,
      address: order.fulfillment.method === "delivery" ? order.fulfillment.address : undefined,
      orderAt: order.paidAt ?? order.createdAt,
      locale: order.locale,
      // Transactional consent decides the channel: opted in → SMS (order &
      // delivery updates); not opted in → none, so dispatchPaymentConfirmed
      // sends nothing.
      messagingChannel: order.smsConsent ? "sms" : "none",
    });

    // Marketing consent is captured separately (a distinct checkbox). Tag the
    // customer so promotional campaigns can target only those who opted in.
    if (order.smsMarketingConsent) {
      addTag(customer.id, "sms-marketing");
    }

    const linked: Order = { ...order, customerId: customer.id };
    await updateOrder(linked);
    await dispatchPaymentConfirmed(linked);
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "web_order_paid_hook_failed",
        orderId,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}
