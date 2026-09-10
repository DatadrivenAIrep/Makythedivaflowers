import "server-only";
import { upsertOnOrder, addTag } from "@/lib/customer-storage";
import { getOrder, updateOrder } from "@/lib/order-storage";
import { dispatchPaymentConfirmed, windowLabel } from "@/lib/order-dispatch";
import { notifyOwner } from "@/lib/notify-owner";
import { rewardsOnOrderPaid } from "@/lib/promo-rewards";
import type { Order } from "@/types/order";

/** The buyer names the customer record — the record keyed by the BUYER's phone.
 *  Never the recipient's name: filing a gift buyer under the name of the person
 *  she sent flowers to means every later order greets her as someone else.
 *  Orders that predate the checkout asking for a buyer name get no name; the shop
 *  can fill it in from the admin. */
function buyerName(order: Order): string {
  return order.contact.name?.trim() ?? "";
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

    // Referral credit and the loyalty reward. Deliberately after the link is
    // written, so the order counts include this one, and never able to throw.
    await rewardsOnOrderPaid(linked);

    const total = `$${(order.totals.totalCents / 100).toFixed(2)}`;
    const num = order.orderNumber != null ? `#${order.orderNumber}` : order.id;
    const when = windowLabel(order, "es");
    await notifyOwner(`Nueva orden web ${num} · ${total} · entrega ${when}. — Diva Flowers`);
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
