"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PaymentMethod } from "@/types/order";

export type DepositMethod = "cash" | "zelle" | "card-terminal" | "ach";

export type PaymentState =
  | { status: "paid"; method: PaymentMethod }
  | { status: "pending"; deposit?: { amountCents: number; method: DepositMethod } };

type Props = {
  value: PaymentState;
  onChange: (v: PaymentState) => void;
  /** Order total, for the live "balance due" hint under the deposit field. */
  totalCents?: number;
};

const DEPOSIT_METHODS: DepositMethod[] = ["cash", "zelle", "card-terminal", "ach"];

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

const METHOD_KEYS: { id: PaymentMethod; key: string }[] = [
  { id: "cash", key: "payment_cash" },
  { id: "zelle", key: "payment_zelle" },
  { id: "card-terminal", key: "payment_card_terminal" },
  { id: "ach", key: "payment_ach" },
  { id: "stripe", key: "payment_stripe" },
];

export default function PaymentBlock({ value, onChange, totalCents }: Props) {
  const t = useTranslations("admin_intake");
  const selectedMethod = value.status === "paid" ? value.method : null;
  const deposit = value.status === "pending" ? value.deposit : undefined;
  // Raw text so "12." or "" can be typed; cents are derived on every change.
  const [depositText, setDepositText] = useState(deposit ? (deposit.amountCents / 100).toFixed(2) : "");
  const [depositMethod, setDepositMethod] = useState<DepositMethod>(deposit?.method ?? "zelle");

  function emitDeposit(text: string, method: DepositMethod) {
    const cents = Math.round(parseFloat(text) * 100);
    onChange(Number.isFinite(cents) && cents > 0
      ? { status: "pending", deposit: { amountCents: cents, method } }
      : { status: "pending" });
  }

  const depositCents = deposit?.amountCents ?? 0;
  const tooBig = totalCents !== undefined && depositCents > 0 && depositCents >= totalCents;
  return (
    <div className="mt-5">
      <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">{t("payment_label")}</label>
      <div className="grid grid-cols-3 gap-2">
        {METHOD_KEYS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange({ status: "paid", method: m.id })}
            className={`py-3.5 rounded-xl text-sm font-medium border transition ${
              selectedMethod === m.id
                ? "bg-ink text-bone border-ink"
                : "bg-white border-mute-200 text-mute-700 hover:border-ink"
            }`}
          >
            {t(m.key)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setDepositText(""); onChange({ status: "pending" }); }}
          className={`py-3.5 rounded-xl text-sm font-medium border border-dashed transition ${
            value.status === "pending"
              ? "bg-warn text-bone border-warn"
              : "bg-warn/[0.05] border-warn text-warn"
          }`}
        >
          {t("payment_pending")}
        </button>
      </div>
      {value.status === "pending" && (
        <div className="mt-3 rounded-xl border border-mute-200 bg-white p-3">
          <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">{t("deposit_label")}</label>
          <div className="flex items-center gap-2">
            <div className="relative w-32 shrink-0">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute-400">$</span>
              <input
                inputMode="decimal"
                value={depositText}
                placeholder={t("deposit_amount_placeholder")}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, "");
                  setDepositText(v);
                  emitDeposit(v, depositMethod);
                }}
                aria-label={t("deposit_label")}
                className="w-full rounded-lg border border-mute-200 py-2 pl-6 pr-2 tabular-nums"
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("deposit_method")}>
              {DEPOSIT_METHODS.map((m) => {
                const key = METHOD_KEYS.find((k) => k.id === m)!.key;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={depositMethod === m}
                    onClick={() => { setDepositMethod(m); emitDeposit(depositText, m); }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      depositMethod === m ? "bg-ink text-bone border-ink" : "border-mute-200 text-mute-700 hover:border-ink"
                    }`}
                  >
                    {t(key)}
                  </button>
                );
              })}
            </div>
          </div>
          {depositCents > 0 && totalCents !== undefined && (
            <p className={`mt-2 text-xs ${tooBig ? "text-error" : "text-mute-600"}`}>
              {tooBig ? t("deposit_too_big") : t("deposit_hint", { amount: money(totalCents - depositCents) })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
