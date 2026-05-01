"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/types/locale";

export function CartEmpty({ locale, onClose }: { locale: Locale; onClose?: () => void }) {
  const t = useTranslations("cart");
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-6">
      <p className="font-display text-2xl text-ink leading-tight">{t("empty_title")}</p>
      <p className="text-sm text-ink/70 max-w-[36ch]">{t("empty_body")}</p>
      <Button asChild variant="primary">
        <Link href={`/${locale}/shop`} onClick={onClose}>
          {t("empty_cta")}
        </Link>
      </Button>
    </div>
  );
}
