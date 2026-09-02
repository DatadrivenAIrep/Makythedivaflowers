"use client";
import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Stripe as StripeJs, StripeElements } from "@stripe/stripe-js";
import { StripePaymentStep } from "@/components/checkout/StripePaymentStep";
import { formatMoneyCents } from "@/lib/format";
import {
  GIFT_CARD_PRESET_CENTS,
  GIFT_CARD_MIN_CENTS,
  GIFT_CARD_MAX_CENTS,
} from "@/schemas/gift-card-purchase";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

type Props = { locale: Locale };

type Stage =
  | { status: "form" }
  | { status: "paying"; clientSecret: string }
  | { status: "done" };

export function GiftCardPurchaseForm({ locale }: Props) {
  const t = useTranslations("gift_cards.form");
  const [amountCents, setAmountCents] = useState<number>(GIFT_CARD_PRESET_CENTS[1]);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [fromLabel, setFromLabel] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [stage, setStage] = useState<Stage>({ status: "form" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stripeRef = useRef<{ stripe: StripeJs; elements: StripeElements } | null>(null);

  const onStripeReady = useCallback((stripe: StripeJs, elements: StripeElements) => {
    stripeRef.current = { stripe, elements };
  }, []);

  const effectiveCents = isCustom
    ? Math.round(Number(customAmount.replace(",", ".")) * 100)
    : amountCents;

  async function startPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!Number.isFinite(effectiveCents) || effectiveCents < GIFT_CARD_MIN_CENTS) {
      setError(t("error_amount", { min: formatMoneyCents(GIFT_CARD_MIN_CENTS, locale) }));
      return;
    }
    if (effectiveCents > GIFT_CARD_MAX_CENTS) {
      setError(t("error_amount_max", { max: formatMoneyCents(GIFT_CARD_MAX_CENTS, locale) }));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/gift-card-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          amountCents: effectiveCents,
          recipientEmail,
          recipientName,
          fromLabel,
          personalMessage,
          purchaserEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) {
        setError(t("error_generic"));
        return;
      }
      setStage({ status: "paying", clientSecret: data.clientSecret });
    } catch {
      setError(t("error_generic"));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!stripeRef.current) return;
    setBusy(true);
    setError(null);
    const { stripe, elements } = stripeRef.current;
    const result = await stripe.confirmPayment({ elements, redirect: "if_required" });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? t("error_generic"));
      return;
    }
    setStage({ status: "done" });
  }

  if (stage.status === "done") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-ink/10 bg-bone p-8 text-center"
      >
        <h2 className="font-display text-2xl tracking-tight text-ink">{t("done_title")}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/75">
          {t("done_body", { email: recipientEmail })}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={startPayment} className="space-y-8">
      <fieldset disabled={stage.status === "paying"} className="space-y-8 disabled:opacity-60">
        <div>
          <legend className="mb-3 block font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
            {t("amount_label")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {GIFT_CARD_PRESET_CENTS.map((cents) => (
              <button
                key={cents}
                type="button"
                aria-pressed={!isCustom && amountCents === cents}
                onClick={() => {
                  setIsCustom(false);
                  setAmountCents(cents);
                }}
                className={cn(
                  "h-11 min-w-20 rounded-full border px-5 font-sans text-sm tracking-tight transition-colors",
                  !isCustom && amountCents === cents
                    ? "border-transparent bg-rouge text-bone"
                    : "border-ink/15 text-ink/85 hover:border-ink/40",
                )}
              >
                {formatMoneyCents(cents, locale)}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={isCustom}
              onClick={() => setIsCustom(true)}
              className={cn(
                "h-11 rounded-full border px-5 font-sans text-sm tracking-tight transition-colors",
                isCustom
                  ? "border-transparent bg-rouge text-bone"
                  : "border-ink/15 text-ink/85 hover:border-ink/40",
              )}
            >
              {t("amount_custom")}
            </button>
          </div>
          {isCustom && (
            <label className="mt-3 block max-w-[12rem]">
              <span className="sr-only">{t("amount_custom")}</span>
              <input
                type="number"
                min={GIFT_CARD_MIN_CENTS / 100}
                max={GIFT_CARD_MAX_CENTS / 100}
                step={1}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="75"
                className="w-full rounded-lg border border-ink/15 bg-bone px-3 py-2 font-mono text-sm text-ink"
              />
            </label>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
              {t("recipient_email")}
            </span>
            <input
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-ink/15 bg-bone px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
              {t("recipient_name")}
            </span>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full rounded-lg border border-ink/15 bg-bone px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
              {t("from_label")}
            </span>
            <input
              value={fromLabel}
              onChange={(e) => setFromLabel(e.target.value)}
              className="w-full rounded-lg border border-ink/15 bg-bone px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
              {t("purchaser_email")}
            </span>
            <input
              type="email"
              required
              value={purchaserEmail}
              onChange={(e) => setPurchaserEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-lg border border-ink/15 bg-bone px-3 py-2 text-sm text-ink"
            />
            <span className="mt-1 block font-mono text-[10px] text-mute-500">
              {t("purchaser_hint")}
            </span>
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
            {t("message_label")}
          </span>
          <textarea
            rows={3}
            maxLength={400}
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            className="w-full rounded-lg border border-ink/15 bg-bone px-3 py-2 text-sm leading-relaxed text-ink"
          />
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="font-mono text-[11px] text-error">
          {error}
        </p>
      )}

      {stage.status === "form" ? (
        <button
          type="submit"
          disabled={busy}
          className="h-12 rounded-full bg-ink px-8 font-sans text-sm font-medium text-bone transition hover:opacity-90 disabled:opacity-50"
        >
          {t("continue")}
        </button>
      ) : (
        <div className="space-y-4">
          <StripePaymentStep clientSecret={stage.clientSecret} onReady={onStripeReady} />
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="h-12 rounded-full bg-rouge px-8 font-sans text-sm font-medium text-bone transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t("paying") : t("pay", { amount: formatMoneyCents(effectiveCents, locale) })}
          </button>
        </div>
      )}
    </form>
  );
}
