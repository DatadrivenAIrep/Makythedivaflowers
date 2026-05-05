import { describe, it, expect, beforeEach, vi } from "vitest";
import * as consent from "@/lib/consent";
import { pushDataLayer } from "@/lib/analytics";
import {
  trackViewItemList,
  trackViewItem,
  trackAddToCart,
  trackRemoveFromCart,
  trackViewCart,
  trackBeginCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  trackPurchase,
} from "@/lib/analytics";
import type { AnalyticsItem } from "@/lib/analytics-types";
import {
  trackNewsletterSignup,
  trackWhatsappClick,
  trackPhoneClick,
  trackContactSubmit,
  trackOccasionSelected,
  trackDeliveryDateSelected,
  trackRecipientInfoCompleted,
} from "@/lib/analytics";

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

describe("pushDataLayer", () => {
  beforeEach(() => {
    window.dataLayer = [];
    vi.restoreAllMocks();
  });

  it("pushes the event when consent is granted", () => {
    vi.spyOn(consent, "hasConsent").mockReturnValue(true);
    pushDataLayer({ event: "test_event", foo: "bar" });
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toEqual({ event: "test_event", foo: "bar" });
  });

  it("does NOT push when consent is denied", () => {
    vi.spyOn(consent, "hasConsent").mockReturnValue(false);
    pushDataLayer({ event: "test_event" });
    expect(window.dataLayer).toHaveLength(0);
  });

  it("creates window.dataLayer if it does not exist", () => {
    vi.spyOn(consent, "hasConsent").mockReturnValue(true);
    // @ts-expect-error reset to undefined
    delete window.dataLayer;
    pushDataLayer({ event: "test_event" });
    expect(Array.isArray(window.dataLayer)).toBe(true);
  });
});

const ITEM: AnalyticsItem = {
  item_id: "p1",
  item_name: "Lush Bouquet",
  item_category: "bouquets",
  item_variant: "lush",
  price: 80,
  quantity: 1,
  currency: "USD",
};

describe("ecommerce events", () => {
  beforeEach(() => {
    window.dataLayer = [];
    vi.spyOn(consent, "hasConsent").mockReturnValue(true);
  });

  it("trackViewItemList pushes view_item_list with item_list_name + items", () => {
    trackViewItemList("bouquets", [ITEM]);
    expect(window.dataLayer[0]).toEqual({
      event: "view_item_list",
      item_list_name: "bouquets",
      items: [ITEM],
    });
  });

  it("trackViewItem pushes view_item with currency, value, items", () => {
    trackViewItem(ITEM);
    expect(window.dataLayer[0]).toEqual({
      event: "view_item",
      currency: "USD",
      value: 80,
      items: [ITEM],
    });
  });

  it("trackAddToCart pushes add_to_cart with currency, value, items", () => {
    trackAddToCart(ITEM);
    expect(window.dataLayer[0]).toMatchObject({
      event: "add_to_cart",
      currency: "USD",
      value: 80,
      items: [ITEM],
    });
  });

  it("trackRemoveFromCart pushes remove_from_cart", () => {
    trackRemoveFromCart(ITEM);
    expect(window.dataLayer[0]).toMatchObject({
      event: "remove_from_cart",
      items: [ITEM],
    });
  });

  it("trackViewCart pushes view_cart with summed value", () => {
    trackViewCart([ITEM, { ...ITEM, item_id: "p2", price: 50 }]);
    expect(window.dataLayer[0]).toMatchObject({
      event: "view_cart",
      currency: "USD",
      value: 130,
    });
  });

  it("trackBeginCheckout pushes begin_checkout with summed value", () => {
    trackBeginCheckout([ITEM]);
    expect(window.dataLayer[0]).toMatchObject({
      event: "begin_checkout",
      currency: "USD",
      value: 80,
    });
  });

  it("trackAddShippingInfo pushes add_shipping_info with shipping_tier", () => {
    trackAddShippingInfo("standard", [ITEM]);
    expect(window.dataLayer[0]).toEqual({
      event: "add_shipping_info",
      currency: "USD",
      value: 80,
      shipping_tier: "standard",
      items: [ITEM],
    });
  });

  it("trackAddPaymentInfo pushes add_payment_info with payment_type", () => {
    trackAddPaymentInfo("card", [ITEM]);
    expect(window.dataLayer[0]).toEqual({
      event: "add_payment_info",
      currency: "USD",
      value: 80,
      payment_type: "card",
      items: [ITEM],
    });
  });

  it("trackPurchase pushes purchase with transaction_id, value, tax, shipping", () => {
    trackPurchase({
      transaction_id: "ord_abc",
      value: 100,
      tax: 8.88,
      shipping: 12,
      items: [ITEM],
    });
    expect(window.dataLayer[0]).toEqual({
      event: "purchase",
      transaction_id: "ord_abc",
      value: 100,
      currency: "USD",
      tax: 8.88,
      shipping: 12,
      items: [ITEM],
    });
  });

  it("ecommerce events no-op when consent is denied", () => {
    vi.spyOn(consent, "hasConsent").mockReturnValue(false);
    trackAddToCart(ITEM);
    expect(window.dataLayer).toHaveLength(0);
  });
});

describe("engagement + diva events", () => {
  beforeEach(() => {
    window.dataLayer = [];
    vi.spyOn(consent, "hasConsent").mockReturnValue(true);
  });

  it("trackNewsletterSignup includes location", () => {
    trackNewsletterSignup("footer");
    expect(window.dataLayer[0]).toEqual({ event: "newsletter_signup", location: "footer" });
  });

  it("trackWhatsappClick includes location and context", () => {
    trackWhatsappClick("pdp", "card-message-help");
    expect(window.dataLayer[0]).toEqual({
      event: "whatsapp_click",
      location: "pdp",
      context: "card-message-help",
    });
  });

  it("trackPhoneClick includes location", () => {
    trackPhoneClick("footer");
    expect(window.dataLayer[0]).toEqual({ event: "phone_click", location: "footer" });
  });

  it("trackContactSubmit includes subject + inquiry_type", () => {
    trackContactSubmit("wedding inquiry", "wedding");
    expect(window.dataLayer[0]).toEqual({
      event: "contact_submit",
      subject: "wedding inquiry",
      inquiry_type: "wedding",
    });
  });

  it("trackOccasionSelected includes occasion slug", () => {
    trackOccasionSelected("anniversary");
    expect(window.dataLayer[0]).toEqual({
      event: "occasion_selected",
      occasion: "anniversary",
    });
  });

  it("trackDeliveryDateSelected computes days_ahead and is_same_day", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);
    trackDeliveryDateSelected(todayIso);
    expect(window.dataLayer[0]).toMatchObject({
      event: "delivery_date_selected",
      days_ahead: 0,
      is_same_day: true,
    });
  });

  it("trackDeliveryDateSelected does not push on invalid date string", () => {
    trackDeliveryDateSelected("not-a-date");
    expect(window.dataLayer).toHaveLength(0);
  });

  it("trackRecipientInfoCompleted includes has_card_message bool", () => {
    trackRecipientInfoCompleted(true);
    expect(window.dataLayer[0]).toEqual({
      event: "recipient_info_completed",
      has_card_message: true,
    });
  });
});
