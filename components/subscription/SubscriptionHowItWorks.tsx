import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

const STEPS = ["step_1", "step_2", "step_3"] as const;

export async function SubscriptionHowItWorks({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "subscriptions.how" });
  return (
    <section className="bg-ink">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16 py-20 md:py-28">
        <h2 className="font-display text-4xl sm:text-5xl text-bone leading-[0.95] tracking-tighter max-w-2xl">
          {t("heading")}
        </h2>
        <ol className="mt-14 grid md:grid-cols-3 border border-bone/10 rounded-2xl overflow-hidden">
          {STEPS.map((key, idx) => (
            <li
              key={key}
              className="flex flex-col gap-4 px-8 py-10 border-b border-bone/10 md:border-b-0 md:border-r last:border-r-0"
            >
              <span
                aria-hidden
                className="font-display text-[5rem] leading-none tracking-tighter text-rouge/20 select-none"
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <p className="font-display text-2xl text-bone tracking-tighter leading-tight">
                {t(`${key}.title`)}
              </p>
              <p className="text-sm text-bone/55 leading-relaxed">{t(`${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
