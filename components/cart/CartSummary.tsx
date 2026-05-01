"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";

type Props = {
  subtotalCents: number;
  locale: Locale;
  onCheckout?: () => void;
};

export function CartSummary({ subtotalCents, locale, onCheckout }: Props) {
  const t = useTranslations("cart");
  return (
    <div className="border-t border-ink/10 px-5 py-5 flex flex-col gap-4 bg-bone/80 backdrop-blur-md">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
          {t("subtotal")}
        </span>
        <span className="font-mono text-base tabular-nums text-ink">
          {formatMoneyCents(subtotalCents, locale)}
        </span>
      </div>
      <p className="text-[11px] text-ink/55 leading-snug">{t("calculated_at_checkout")}</p>
      <Button asChild variant="primary" className="w-full">
        <Link href={`/${locale}/checkout`} onClick={onCheckout}>
          {t("checkout_cta")}
        </Link>
      </Button>
    </div>
  );
}
