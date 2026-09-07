"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";

export type AppliedPromo = { code: string; discountCents: number };

type Props = {
  subtotalCents: number;
  deliveryCents: number;
  locale: Locale;
  /** Buyer identity — only used to gate first-order / assigned codes. */
  phone?: string;
  email?: string;
  applied: AppliedPromo | null;
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

/**
 * Staff-side promo entry for intake. Deliberately separate from the customer
 * checkout field: staff build the cart live, so an applied code is re-priced
 * whenever the subtotal or delivery changes — a percentage discount tracks the
 * cart, and a code that no longer qualifies is removed rather than left stale.
 * Validation reuses the same /api/checkout/promo endpoint, so the rules match
 * the website exactly.
 */
export default function PromoField({
  subtotalCents,
  deliveryCents,
  locale,
  phone,
  email,
  applied,
  onApply,
  onClear,
}: Props) {
  const t = useTranslations("checkout");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  type Result = { ok: true; promo: AppliedPromo } | { ok: false; message: string };

  async function validate(raw: string): Promise<Result> {
    const res = await fetch("/api/checkout/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: raw, subtotalCents, deliveryCents, phone, email }),
    });
    const data = await res.json();
    if (!data.valid) {
      const reason = KNOWN_REASONS.has(data.reason) ? data.reason : "invalid";
      const message =
        reason === "below_minimum" && typeof data.minSubtotalCents === "number"
          ? t("promo.error.below_minimum", { amount: formatMoneyCents(data.minSubtotalCents, locale) })
          : t(`promo.error.${reason}`);
      return { ok: false, message };
    }
    return { ok: true, promo: { code: data.code as string, discountCents: data.discountCents as number } };
  }

  async function apply() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const r = await validate(trimmed);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onApply(r.promo);
      setCode("");
    } catch {
      setError(t("promo.error.invalid"));
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setCode("");
    setError(null);
    onClear();
  }

  // Re-price the applied code when the cart behind it changes. Keyed on the code
  // (not its amount) so updating the discount never re-triggers this effect.
  const appliedCode = applied?.code;
  const appliedDiscount = applied?.discountCents;
  useEffect(() => {
    if (!appliedCode) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const r = await validate(appliedCode);
        if (cancelled) return;
        if (!r.ok) {
          setError(r.message);
          onClear();
          return;
        }
        if (r.promo.discountCents !== appliedDiscount) onApply(r.promo);
      } catch {
        // Transient network error: keep the current discount rather than dropping it.
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalCents, deliveryCents, appliedCode]);

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-bone/60 px-3 py-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/80">
          {applied.code}
          <span className="ml-2 text-rouge">−{formatMoneyCents(applied.discountCents, locale)}</span>
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
      <span className="block text-xs font-semibold">{t("promo.label")}</span>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void apply();
            }
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t("promo.placeholder")}
          className="min-w-0 flex-1 rounded-lg border border-ink/20 px-3 py-2 font-mono uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-ink/35"
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
