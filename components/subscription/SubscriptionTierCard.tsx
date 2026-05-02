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
        "relative flex h-full flex-col rounded-[var(--radius-bento)] border text-left transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge/50",
        selected
          ? "border-rouge bg-ink text-bone shadow-[0_8px_32px_rgba(184,52,94,0.25)]"
          : "border-ink/10 bg-bone shadow-[var(--shadow-tile-rest)] hover:border-ink/25 hover:shadow-md",
      )}
    >
      {plan.popular && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-rouge px-3.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-bone whitespace-nowrap">
          {t("popular_badge")}
        </span>
      )}

      {/* Plan id + name */}
      <div className={cn("px-6 pt-8 pb-5 border-b", selected ? "border-bone/10" : "border-ink/8")}>
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.22em]",
            selected ? "text-bone/50" : "text-mute-500",
          )}
        >
          {plan.id}
        </span>
        <p
          className={cn(
            "mt-1.5 font-display text-3xl tracking-tighter leading-none",
            selected ? "text-bone" : "text-ink",
          )}
        >
          {name}
        </p>
      </div>

      {/* Price */}
      <div className={cn("px-6 py-5 border-b", selected ? "border-bone/10" : "border-ink/8")}>
        <span
          className={cn(
            "font-display text-5xl tracking-tighter",
            selected ? "text-bone" : "text-ink",
          )}
        >
          {formatMoneyCents(plan.priceCents, locale)}
        </span>
        <span
          className={cn(
            "mt-0.5 block font-mono text-[10px] uppercase tracking-[0.18em]",
            selected ? "text-bone/45" : "text-mute-500",
          )}
        >
          {t("per_delivery")}
        </span>
      </div>

      {/* Blurb + highlights */}
      <div className="flex flex-col gap-5 px-6 py-5 flex-1">
        <p className={cn("text-sm leading-relaxed", selected ? "text-bone/70" : "text-ink/70")}>
          {plan.blurb[locale]}
        </p>
        <ul className="flex flex-col gap-2">
          {plan.highlights.map((h, i) => (
            <li key={i} className="flex gap-2.5 items-start">
              <span
                aria-hidden
                className={cn(
                  "mt-[7px] size-1 shrink-0 rounded-full",
                  selected ? "bg-rouge" : "bg-ink/35",
                )}
              />
              <span className={cn("text-sm leading-snug", selected ? "text-bone/80" : "text-ink/80")}>
                {h[locale]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <span
          className={cn(
            "inline-flex w-full items-center justify-center rounded-full px-4 py-3 font-sans text-sm font-medium tracking-tight transition-colors",
            selected ? "bg-rouge text-bone" : "bg-ink/8 text-ink hover:bg-ink/14",
          )}
        >
          {selected ? t("selected") : t("cta", { name })}
        </span>
      </div>
    </button>
  );
}

export const SubscriptionTierCard = memo(SubscriptionTierCardImpl);
