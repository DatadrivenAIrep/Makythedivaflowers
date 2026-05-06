import { hasConsent } from "@/lib/consent";
import type { AnalyticsItem, EngagementLocation } from "@/lib/analytics-types";

export type DataLayerEvent = { event: string } & Record<string, unknown>;

export function pushDataLayer(payload: DataLayerEvent): void {
  if (typeof window === "undefined") return;
  if (!hasConsent()) return;
  if (!Array.isArray((window as unknown as { dataLayer?: unknown[] }).dataLayer)) {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  }
  (window as unknown as { dataLayer: unknown[] }).dataLayer.push(payload);
}

// ─── Ecommerce helpers ───────────────────────────────────────────────────────

function sumValue(items: AnalyticsItem[]): number {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

export function trackViewItemList(itemListName: string, items: AnalyticsItem[]): void {
  pushDataLayer({ event: "view_item_list", item_list_name: itemListName, items });
}

export function trackViewItem(item: AnalyticsItem): void {
  pushDataLayer({
    event: "view_item",
    currency: item.currency,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackAddToCart(item: AnalyticsItem): void {
  pushDataLayer({
    event: "add_to_cart",
    currency: item.currency,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackRemoveFromCart(item: AnalyticsItem): void {
  pushDataLayer({
    event: "remove_from_cart",
    currency: item.currency,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackViewCart(items: AnalyticsItem[]): void {
  pushDataLayer({
    event: "view_cart",
    currency: "USD",
    value: sumValue(items),
    items,
  });
}

export function trackBeginCheckout(items: AnalyticsItem[], coupon?: string): void {
  pushDataLayer({
    event: "begin_checkout",
    currency: "USD",
    value: sumValue(items),
    items,
    ...(coupon ? { coupon } : {}),
  });
}

export function trackAddShippingInfo(shippingTier: string, items: AnalyticsItem[]): void {
  pushDataLayer({
    event: "add_shipping_info",
    currency: "USD",
    value: sumValue(items),
    shipping_tier: shippingTier,
    items,
  });
}

export function trackAddPaymentInfo(paymentType: string, items: AnalyticsItem[]): void {
  pushDataLayer({
    event: "add_payment_info",
    currency: "USD",
    value: sumValue(items),
    payment_type: paymentType,
    items,
  });
}

export type PurchasePayload = {
  transaction_id: string;
  value: number;
  tax: number;
  shipping: number;
  items: AnalyticsItem[];
};

export function trackPurchase(p: PurchasePayload): void {
  pushDataLayer({
    event: "purchase",
    transaction_id: p.transaction_id,
    value: p.value,
    currency: "USD",
    tax: p.tax,
    shipping: p.shipping,
    items: p.items,
  });
}

// ─── Engagement + Diva-specific helpers ─────────────────────────────────────

export function trackNewsletterSignup(location: EngagementLocation): void {
  pushDataLayer({ event: "newsletter_signup", location });
}

export function trackWhatsappClick(location: EngagementLocation, context: string): void {
  pushDataLayer({ event: "whatsapp_click", location, context });
}

export function trackPhoneClick(location: EngagementLocation): void {
  pushDataLayer({ event: "phone_click", location });
}

export function trackContactSubmit(subject: string, inquiryType: string): void {
  pushDataLayer({ event: "contact_submit", subject, inquiry_type: inquiryType });
}

export function trackOccasionSelected(occasion: string): void {
  pushDataLayer({ event: "occasion_selected", occasion });
}

export function trackDeliveryDateSelected(dateIso: string): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateIso}T00:00:00`);
  if (isNaN(target.getTime())) return;
  const daysAhead = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  pushDataLayer({
    event: "delivery_date_selected",
    days_ahead: daysAhead,
    is_same_day: daysAhead === 0,
  });
}

export function trackRecipientInfoCompleted(hasCardMessage: boolean): void {
  pushDataLayer({ event: "recipient_info_completed", has_card_message: hasCardMessage });
}

// ─── Mother's Day campaign events ────────────────────────────────────────────

export function trackMothersDayView(): void {
  pushDataLayer({ event: "mothers_day_view" });
}

export function trackZipCheckPass(args: { zip: string; zoneId: string }): void {
  pushDataLayer({ event: "zip_check_pass", zip: args.zip, zone_id: args.zoneId });
}

export function trackZipCheckFail(args: { zip: string }): void {
  pushDataLayer({ event: "zip_check_fail", zip: args.zip });
}

export function trackCutoffBannerClick(): void {
  pushDataLayer({ event: "cutoff_banner_click" });
}
