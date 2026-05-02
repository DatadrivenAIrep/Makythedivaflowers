"use client";
import { memo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";
import type { SubscriptionPlan } from "@/data/subscription-plans";

type Props = {
  locale: Locale;
  plan: SubscriptionPlan;
  selected: boolean;
  onSelect: (id: SubscriptionPlan["id"]) => void;
};

function SubscriptionTierCardImpl({ locale, plan, selected, onSelect }: Props) {
  const t = useTranslations("subscriptions.tiers");
  const name = plan.name[locale];

  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      aria-pressed={selected}
      className={cn(
        "relative flex h-full flex-col gap-5 rounded-[var(--radius-bento)] border bg-bone p-6 md:p-7 text-left",
        "shadow-[var(--shadow-tile-rest)] transition-colors",
        selected ? "border-rouge ring-1 ring-rouge/40" : "border-ink/10 hover:border-ink/30",
      )}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-6 rounded-full bg-rouge px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-bone">
          {t("popular_badge")}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
          {plan.id}
        </span>
        <p className="font-display text-3xl tracking-tighter leading-tight">{name}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl tracking-tighter">
          {formatMoneyCents(plan.priceCents, locale)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
          {t("per_delivery")}
        </span>
      </div>
      <p className="text-sm text-ink/75 leading-relaxed">{plan.blurb[locale]}</p>
      <ul className="flex flex-col gap-1.5 text-sm text-ink/85">
        {plan.highlights.map((h, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink/40" />
            <span>{h[locale]}</span>
          </li>
        ))}
      </ul>
      <span
        className={cn(
          "mt-auto inline-flex w-fit items-center rounded-full px-4 py-2.5 font-sans text-sm font-medium tracking-tight transition-colors",
          selected ? "bg-rouge text-bone" : "bg-ink text-bone",
        )}
      >
        {selected ? t("selected") : t("cta", { name })}
      </span>
    </button>
  );
}

export const SubscriptionTierCard = memo(SubscriptionTierCardImpl);
