"use client";
import { Minus, Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

type Props = {
  qty: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
};

export function CartLineQty({ qty, onChange, min = 0, max = 99 }: Props) {
  const t = useTranslations("cart");
  const dec = () => onChange(Math.max(min, qty - 1));
  const inc = () => onChange(Math.min(max, qty + 1));
  return (
    <div
      role="group"
      aria-label={t("qty_label")}
      className="inline-flex items-center gap-1 rounded-full border border-ink/10 px-1 py-0.5"
    >
      <button
        type="button"
        onClick={dec}
        aria-label={t("qty_decrease")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink/70 hover:text-ink hover:bg-ink/5 disabled:opacity-30"
        disabled={qty <= min}
      >
        <Minus size={12} />
      </button>
      <span className="font-mono text-[12px] tabular-nums w-5 text-center">{qty}</span>
      <button
        type="button"
        onClick={inc}
        aria-label={t("qty_increase")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink/70 hover:text-ink hover:bg-ink/5 disabled:opacity-30"
        disabled={qty >= max}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
