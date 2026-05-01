"use client";
import { memo, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/types/locale";
import { listAvailableDates, isSameDayEligible, toIsoDate } from "@/lib/delivery";
import { cn } from "@/lib/cn";

type Props = {
  locale: Locale;
  cutoff: string;
  value: string;
  onChange: (iso: string) => void;
};

function DeliveryDatePickerImpl({ locale, cutoff, value, onChange }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const dates = useMemo(() => (now ? listAvailableDates(now, cutoff, 14) : []), [now, cutoff]);
  const eligible = now ? isSameDayEligible(now, cutoff) : false;
  const today = now ? toIsoDate(now) : "";

  useEffect(() => {
    if (now && !value && dates.length > 0) onChange(dates[0]);
  }, [now, value, dates, onChange]);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {locale === "es" ? "Fecha de entrega" : "Delivery date"}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dates.map((iso) => {
          const d = new Date(iso + "T00:00:00");
          const selected = iso === value;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              aria-pressed={selected}
              className={cn(
                "flex h-16 min-w-[5rem] flex-col items-center justify-center rounded-[var(--radius-product)] border px-3 text-center transition-colors",
                selected ? "border-transparent bg-ink text-bone" : "border-ink/15 text-ink/85 hover:border-ink/40",
              )}
            >
              <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
                {isToday ? (locale === "es" ? "Hoy" : "Today") : fmt.format(d).split(",")[0]}
              </span>
              <span className="font-mono text-sm">{fmt.format(d).split(",").slice(1).join(",").trim()}</span>
            </button>
          );
        })}
      </div>
      {now && !eligible && (
        <p className="font-sans text-xs text-mute-500">
          {locale === "es"
            ? `Pasamos del corte de hoy (${cutoff}). Mismo día disponible mañana.`
            : `Past today's cutoff (${cutoff}). Same-day available tomorrow.`}
        </p>
      )}
    </div>
  );
}

export const DeliveryDatePicker = memo(DeliveryDatePickerImpl);
