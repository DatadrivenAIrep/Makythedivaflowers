"use client";
import { useTranslations } from "next-intl";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

/** Fixed amounts rather than percentages: a percentage of a $600 anniversary
 *  piece is not what anyone means by a tip for the person who drove it. */
export const TIP_OPTIONS_CENTS = [0, 500, 1000, 1500] as const;

type Props = {
  value: number;
  onChange: (cents: number) => void;
  locale: Locale;
};

export function TipField({ value, onChange, locale }: Props) {
  const t = useTranslations("checkout.tip");

  return (
    <fieldset className="space-y-3">
      <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
        {t("label")}
      </legend>
      <p className="text-sm leading-relaxed text-ink/70">{t("body")}</p>
      <div className="flex flex-wrap gap-2">
        {TIP_OPTIONS_CENTS.map((cents) => (
          <button
            key={cents}
            type="button"
            aria-pressed={value === cents}
            onClick={() => onChange(cents)}
            className={cn(
              "h-10 min-w-16 rounded-full border px-4 font-sans text-sm tracking-tight transition-colors",
              value === cents
                ? "border-transparent bg-rouge text-bone"
                : "border-ink/15 text-ink/85 hover:border-ink/40",
            )}
          >
            {cents === 0 ? t("none") : formatMoneyCents(cents, locale)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
