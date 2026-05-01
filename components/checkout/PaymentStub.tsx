// components/checkout/PaymentStub.tsx
"use client";
import { CreditCard } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

export function PaymentStub({ submitting }: { submitting: boolean }) {
  const t = useTranslations("checkout");
  return (
    <div className="rounded-2xl border border-dashed border-ink/20 bg-bone/60 p-6 space-y-3">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
        <CreditCard size={14} />
        {t("payment_stub_label")}
      </div>
      <p className="text-sm text-ink/75 max-w-[48ch]">
        {t("payment_stub_body")}
      </p>
      {submitting && (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rouge animate-pulse">
          {t("payment_stub_processing")}
        </p>
      )}
    </div>
  );
}
