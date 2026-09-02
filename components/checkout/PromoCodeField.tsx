"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";

export type AppliedPromo = { code: string; discountCents: number };

type Props = {
  subtotalCents: number;
  deliveryCents: number;
  locale: Locale;
  /** Passed to the API only to gate first-order codes. */
  phone?: string;
  email?: string;
  onApply: (promo: AppliedPromo) => void;
  onClear: () => void;
};

/** Reasons the server can return. Anything else falls back to the generic message. */
const KNOWN_REASONS = new Set([
  "invalid",
  "inactive",
  "not_started",
  "expired",
  "below_minimum",
  "exhausted",
  "not_first_order",
  "not_yours",
  "no_discount",
  "rate_limited",
]);

export function PromoCodeField({
  subtotalCents,
  deliveryCents,
  locale,
  phone,
  email,
  onApply,
  onClear,
}: Props) {
  const t = useTranslations("checkout");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<AppliedPromo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, subtotalCents, deliveryCents, phone, email }),
      });
      const data = await res.json();
      if (!data.valid) {
        const reason = KNOWN_REASONS.has(data.reason) ? data.reason : "invalid";
        setError(
          reason === "below_minimum" && typeof data.minSubtotalCents === "number"
            ? t("promo.error.below_minimum", {
                amount: formatMoneyCents(data.minSubtotalCents, locale),
              })
            : t(`promo.error.${reason}`),
        );
        return;
      }
      const next = { code: data.code as string, discountCents: data.discountCents as number };
      setApplied(next);
      onApply(next);
    } catch {
      // A refused code and an unreachable network look the same to the buyer:
      // the code did not apply. Never fail silently and leave the field looking
      // accepted.
      setError(t("promo.error.invalid"));
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setApplied(null);
    setCode("");
    setError(null);
    onClear();
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-bone/60 px-3 py-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/80">
          {applied.code}
          <span className="ml-2 text-rouge">
            −{formatMoneyCents(applied.discountCents, locale)}
          </span>
        </p>
        <button
          type="button"
          onClick={clear}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60 underline-offset-4 hover:text-ink hover:underline"
        >
          {t("promo.remove")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor="promo-code"
        className="block font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500"
      >
        {t("promo.label")}
      </label>
      <div className="flex gap-2">
        <input
          id="promo-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // The field lives inside the checkout form; Enter must apply the
              // code, not submit the order.
              e.preventDefault();
              void apply();
            }
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t("promo.placeholder")}
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-bone px-3 py-2 font-mono text-sm uppercase tracking-widest text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge/50"
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy}
          className="shrink-0 rounded-lg border border-ink/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition hover:bg-ink/[0.04] disabled:opacity-50"
        >
          {t("promo.apply")}
        </button>
      </div>
      {error && (
        <p role="alert" className="font-mono text-[11px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export default PromoCodeField;
