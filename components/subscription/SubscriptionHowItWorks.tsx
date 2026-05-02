import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

const STEPS = ["step_1", "step_2", "step_3"] as const;

export async function SubscriptionHowItWorks({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "subscriptions.how" });
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 border-t border-ink/10">
      <h2 className="font-display text-4xl sm:text-5xl text-ink leading-[0.95] tracking-tighter max-w-2xl">
        {t("heading")}
      </h2>
      <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
        {STEPS.map((key, idx) => (
          <li key={key} className="flex flex-col gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <p className="font-display text-2xl tracking-tighter leading-tight">
              {t(`${key}.title`)}
            </p>
            <p className="text-sm text-ink/75 leading-relaxed">{t(`${key}.body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
