"use client";
import { memo } from "react";
import type { Locale } from "@/types/locale";
import type { SubscriptionCadence as Cadence } from "@/types/product";
import { cn } from "@/lib/cn";

type Props = {
  locale: Locale;
  cadences: Cadence[];
  value: Cadence;
  onChange: (c: Cadence) => void;
};

function SubscriptionCadenceImpl({ locale, cadences, value, onChange }: Props) {
  const label: Record<Cadence, { en: string; es: string }> = {
    weekly: { en: "Weekly", es: "Semanal" },
    biweekly: { en: "Biweekly", es: "Quincenal" },
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {locale === "es" ? "Cadencia" : "Cadence"}
      </p>
      <div className="flex gap-2">
        {cadences.map((c) => {
          const selected = c === value;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-pressed={selected}
              className={cn(
                "inline-flex h-11 items-center rounded-full border px-4 font-sans text-sm tracking-tight transition-colors",
                selected ? "border-transparent bg-ink text-bone" : "border-ink/15 text-ink/85 hover:border-ink/40",
              )}
            >
              {label[c][locale]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const SubscriptionCadence = memo(SubscriptionCadenceImpl);
