"use client";
import { memo } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from "@/data/subscription-plans";
import { SubscriptionTierCard } from "@/components/subscription/SubscriptionTierCard";

type Props = {
  locale: Locale;
  selected: SubscriptionPlanId;
  onSelect: (id: SubscriptionPlanId) => void;
};

function SubscriptionTiersImpl({ locale, selected, onSelect }: Props) {
  const t = useTranslations("subscriptions.tiers");
  return (
    <section className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16 pt-14 pb-20 md:pt-16 md:pb-28">
      <header className="mb-10 max-w-2xl">
        <h2 className="font-display text-4xl sm:text-5xl text-ink leading-[0.95] tracking-tighter">
          {t("heading")}
        </h2>
      </header>
      <div className="grid gap-6 md:grid-cols-3 md:gap-5 mt-2">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <SubscriptionTierCard
            key={plan.id}
            locale={locale}
            plan={plan}
            selected={selected === plan.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export const SubscriptionTiers = memo(SubscriptionTiersImpl);
