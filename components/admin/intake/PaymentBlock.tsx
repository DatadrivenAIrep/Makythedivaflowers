"use client";
import type { PaymentMethod } from "@/types/order";

export type PaymentState =
  | { status: "paid"; method: PaymentMethod }
  | { status: "pending" };

type Props = { value: PaymentState; onChange: (v: PaymentState) => void };

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "zelle", label: "Zelle" },
  { id: "card-terminal", label: "Terminal" },
  { id: "ach", label: "ACH" },
  { id: "stripe", label: "Stripe" },
];

export default function PaymentBlock({ value, onChange }: Props) {
  const selectedMethod = value.status === "paid" ? value.method : null;
  return (
    <div className="mt-5">
      <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">Pago</label>
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
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
            {m.label}
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
          Pendiente
        </button>
      </div>
    </div>
  );
}
