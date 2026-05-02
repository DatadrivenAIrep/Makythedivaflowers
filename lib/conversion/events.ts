// lib/conversion/events.ts
export const CONV_EVENTS = {
  cutoff: { view: "cutoff_view", expired_in_session: "cutoff_expired_in_session" },
  reviews: { view: "pdp_reviews_view", expand: "pdp_reviews_expand" },
  variants: { default_changed: "variant_default_changed" },
  upsell: { view: "cart_upsell_view", add: "cart_upsell_add", dismiss: "cart_upsell_dismiss" },
  assurance: { view: "assurance_view" },
  reciprocity: { referral_copy: "referral_copy", subscription_click: "subscription_nudge_click" },
} as const;
