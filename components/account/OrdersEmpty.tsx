// components/account/OrdersEmpty.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/types/locale";

export async function OrdersEmpty({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "account.orders" });
  return (
    <div className="py-16 text-center space-y-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">{t("stub_notice")}</p>
      <h2 className="font-display text-4xl text-ink leading-tight">{t("empty_title")}</h2>
      <p className="text-ink/70 max-w-[44ch] mx-auto">{t("empty_body")}</p>
      <Button asChild variant="primary" size="md">
        <Link href={`/${locale}/shop`}>{t("empty_cta")}</Link>
      </Button>
    </div>
  );
}
