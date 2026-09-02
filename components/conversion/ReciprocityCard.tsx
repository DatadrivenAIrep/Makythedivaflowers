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
  /** The buyer's own code to share. Absent until the order is linked to a customer. */
  referralCode?: string;
};

/**
 * Post-purchase nudge on the confirmation page.
 *
 * The referral block is shown only when there is a real code behind it. It used
 * to print a DIVA-XXXX code no endpoint could redeem, which read as an offer and
 * then failed at checkout; now the code comes from the promo engine, gives the
 * friend $15 and credits the referrer $15 once that order is paid.
 */
export function ReciprocityCard({ order, locale, referralCode }: Props) {
  const t = useTranslations("conversion.reciprocity");

  const hasSubscription = order.lines.some((l) => {
    if (l.kind !== "catalog") return false;
    const p = PRODUCTS.find((p) => p.id === l.productId);
    return p?.category === "subscriptions";
  });

  if (hasSubscription && !referralCode) return null;

  return (
    <section className="space-y-6 rounded-2xl border border-ink/10 bg-bone/40 p-6">
      {referralCode && (
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
            {t("referral_eyebrow")}
          </p>
          <h2 className="font-display text-xl text-ink leading-tight">{t("referral_title")}</h2>
          <p className="text-sm text-ink/75 max-w-[58ch]">{t("referral_body")}</p>
          <code
            aria-label={`${t("referral_eyebrow")} ${referralCode}`}
            className="inline-block rounded-lg border border-ink/15 bg-bone px-3 py-2 font-mono text-sm tracking-widest text-ink"
          >
            {referralCode}
          </code>
        </div>
      )}
      {!hasSubscription && (
        <div className={referralCode ? "space-y-3 border-t border-ink/10 pt-6" : "space-y-3"}>
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
        </div>
      )}
    </section>
  );
}
