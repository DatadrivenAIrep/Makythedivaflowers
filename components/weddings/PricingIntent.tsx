// components/weddings/PricingIntent.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function PricingIntent({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "weddings.pricing" });
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <p className="mt-6 font-display text-3xl sm:text-4xl text-ink leading-tight">
          {t("statement_full")}
        </p>
        <p className="mt-6 text-sm text-ink/65 max-w-[58ch] mx-auto">{t("statement_personal")}</p>
      </div>
    </section>
  );
}
