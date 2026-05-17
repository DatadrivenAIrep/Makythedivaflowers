"use client";
import { useTranslations } from "next-intl";
import type { PaymentMethod } from "@/types/order";

export type PaymentState =
  | { status: "paid"; method: PaymentMethod }
  | { status: "pending" };

type Props = { value: PaymentState; onChange: (v: PaymentState) => void };

const METHOD_KEYS: { id: PaymentMethod; key: string }[] = [
  { id: "cash", key: "payment_cash" },
  { id: "zelle", key: "payment_zelle" },
  { id: "card-terminal", key: "payment_card_terminal" },
  { id: "ach", key: "payment_ach" },
  { id: "stripe", key: "payment_stripe" },
];

export default function PaymentBlock({ value, onChange }: Props) {
  const t = useTranslations("admin_intake");
  const selectedMethod = value.status === "paid" ? value.method : null;
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
          onClick={() => onChange({ status: "pending" })}
          className={`py-3.5 rounded-xl text-sm font-medium border border-dashed transition ${
            value.status === "pending"
              ? "bg-warn text-bone border-warn"
              : "bg-warn/[0.05] border-warn text-warn"
          }`}
        >
          {t("payment_pending")}
        </button>
      </div>
    </div>
  );
}
