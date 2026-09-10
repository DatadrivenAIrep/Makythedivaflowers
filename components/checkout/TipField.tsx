"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

/** Fixed amounts rather than percentages: a percentage of a $600 anniversary
 *  piece is not what anyone means by a tip for the person who drove it. */
export const TIP_OPTIONS_CENTS = [0, 500, 1000, 1500] as const;

/** Mirrors the cap in /api/checkout/intent, which refuses anything larger. The
 *  input clamps to it so a typo can never bounce the whole checkout. */
export const MAX_TIP_CENTS = 20000;

/** Dollars as typed → cents, clamped. Junk (or empty) reads as no tip. */
export function centsFromDollarInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dollars = Number.parseFloat(cleaned);
  if (!Number.isFinite(dollars) || dollars <= 0) return 0;
  return Math.min(Math.round(dollars * 100), MAX_TIP_CENTS);
}

function dollarsFromCents(cents: number): string {
  if (cents <= 0) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

type Props = {
  value: number;
  onChange: (cents: number) => void;
  locale: Locale;
};

export function TipField({ value, onChange, locale }: Props) {
  const t = useTranslations("checkout.tip");
  const presets = TIP_OPTIONS_CENTS as readonly number[];
  const [customOpen, setCustomOpen] = useState(() => value > 0 && !presets.includes(value));
  const [draft, setDraft] = useState(() => (presets.includes(value) ? "" : dollarsFromCents(value)));

  // Commit the typed amount on a delay. Every committed change re-prices the
  // Stripe PaymentIntent — and creates an order row server-side — so committing
  // per keystroke would fire a request per digit.
  useEffect(() => {
    if (!customOpen) return;
    const next = centsFromDollarInput(draft);
    if (next === value) return;
    const handle = setTimeout(() => onChange(next), 600);
    return () => clearTimeout(handle);
  }, [draft, customOpen, value, onChange]);

  function pickPreset(cents: number) {
    setCustomOpen(false);
    setDraft("");
    onChange(cents);
  }

  function openCustom() {
    // Carry the current amount over so switching to "other" never silently
    // drops a tip the buyer already chose.
    setDraft(dollarsFromCents(value));
    setCustomOpen(true);
  }

  const overMax = centsFromDollarInput(draft) >= MAX_TIP_CENTS && draft.trim() !== "";

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
            aria-pressed={!customOpen && value === cents}
            onClick={() => pickPreset(cents)}
            className={cn(
              "h-10 min-w-16 rounded-full border px-4 font-sans text-sm tracking-tight transition-colors",
              !customOpen && value === cents
                ? "border-transparent bg-rouge text-bone"
                : "border-ink/15 text-ink/85 hover:border-ink/40",
            )}
          >
            {cents === 0 ? t("none") : formatMoneyCents(cents, locale)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={customOpen}
          onClick={openCustom}
          className={cn(
            "h-10 min-w-16 rounded-full border px-4 font-sans text-sm tracking-tight transition-colors",
            customOpen
              ? "border-transparent bg-rouge text-bone"
              : "border-ink/15 text-ink/85 hover:border-ink/40",
          )}
        >
          {t("custom")}
        </button>
      </div>

      {customOpen && (
        <div className="space-y-1.5">
          <label htmlFor="ck-tip-custom" className="block text-xs font-semibold text-ink/80">
            {t("custom_label")}
          </label>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="font-sans text-sm text-ink/60">
              $
            </span>
            <input
              id="ck-tip-custom"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="0"
              className="h-10 w-32 rounded-lg border border-ink/20 px-3 font-sans text-sm tracking-tight tabular-nums"
            />
          </div>
          {overMax && (
            <p className="font-mono text-[11px] text-ink/60">
              {t("max_note", { amount: formatMoneyCents(MAX_TIP_CENTS, locale) })}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
