"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PRODUCTS } from "@/data/products";
import { deriveReferralCode } from "@/lib/conversion/referral-code";
import { CONV_EVENTS } from "@/lib/conversion/events";
import type { Order } from "@/types/order";
import type { Locale } from "@/types/locale";

type Props = {
  order: Order;
  locale: Locale;
};

export function ReciprocityCard({ order, locale }: Props) {
  const t = useTranslations("conversion.reciprocity");
  const [copied, setCopied] = useState(false);

  const code = deriveReferralCode(order.id);

  const hasSubscription = order.lines.some((l) => {
    const p = PRODUCTS.find((p) => p.id === l.productId);
    return p?.category === "subscriptions";
  });

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="space-y-6 rounded-2xl border border-ink/10 bg-bone/40 p-6">
      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
          {t("referral_eyebrow")}
        </p>
        <h2 className="font-display text-2xl text-ink leading-tight">{t("referral_title")}</h2>
        <p className="text-sm text-ink/75 max-w-[58ch]">{t("referral_body")}</p>
        <div className="flex items-center gap-3 mt-2">
          <code
            aria-label={`Referral code ${code}`}
            className="rounded-lg border border-ink/15 bg-bone px-3 py-2 font-mono text-sm tracking-widest text-ink"
          >
            {code}
          </code>
          <button
            type="button"
            onClick={onCopy}
            data-conv-event={CONV_EVENTS.reciprocity.referral_copy}
            aria-live="polite"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-rouge hover:underline"
          >
            {copied ? t("referral_copied") : t("referral_copy_cta")}
          </button>
        </div>
      </div>

      {!hasSubscription && (
        <div className="space-y-3 border-t border-ink/10 pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
            {t("subscription_eyebrow")}
          </p>
          <h3 className="font-display text-xl text-ink leading-tight">{t("subscription_title")}</h3>
          <p className="text-sm text-ink/75 max-w-[58ch]">{t("subscription_body")}</p>
          <Link
            href={`/${locale}/shop?category=subscriptions`}
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
