import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function SubscriptionHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "subscriptions" });
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-12 md:pb-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl sm:text-6xl md:text-7xl text-ink leading-[0.95] tracking-tighter">
        {t("hero.title")}
      </h1>
      <p className="mt-6 max-w-xl text-ink/75 leading-relaxed">{t("hero.body")}</p>
    </section>
  );
}
