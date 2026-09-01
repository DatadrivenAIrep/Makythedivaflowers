"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PRODUCTS } from "@/data/products";
import { CONV_EVENTS } from "@/lib/conversion/events";
import type { Order } from "@/types/order";
import type { Locale } from "@/types/locale";

type Props = {
  order: Order;
  locale: Locale;
};

/**
 * Post-purchase nudge on the confirmation page.
 *
 * The referral block that used to lead this card was removed on purpose: it
 * handed the buyer a DIVA-XXXX code that no endpoint could redeem, so the offer
 * read as real and then failed at checkout. `lib/conversion/referral-code.ts`
 * and the `referral_*` copy keys are kept for the promo-engine work that will
 * make it redeemable — restore the block only once a code entered at checkout
 * actually discounts the order.
 *
 * What remains is the subscription nudge, and it is skipped for buyers who just
 * subscribed.
 */
export function ReciprocityCard({ order, locale }: Props) {
  const t = useTranslations("conversion.reciprocity");

  const hasSubscription = order.lines.some((l) => {
    if (l.kind !== "catalog") return false;
    const p = PRODUCTS.find((p) => p.id === l.productId);
    return p?.category === "subscriptions";
  });

  if (hasSubscription) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-ink/10 bg-bone/40 p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
        {t("subscription_eyebrow")}
      </p>
      <h2 className="font-display text-xl text-ink leading-tight">{t("subscription_title")}</h2>
      <p className="text-sm text-ink/75 max-w-[58ch]">{t("subscription_body")}</p>
      <Link
        href={`/${locale}/shop/subscriptions`}
        data-conv-event={CONV_EVENTS.reciprocity.subscription_click}
        className="inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-rouge hover:underline mt-1"
      >
        {t("subscription_cta")} →
      </Link>
    </section>
  );
}
