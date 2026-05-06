import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function MothersDayFaq({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "mothers_day" });
  const faqs = [
    { q: t("faq_when_q"), a: t("faq_when_a") },
    { q: t("faq_sunday_q"), a: t("faq_sunday_a") },
    { q: t("faq_not_home_q"), a: t("faq_not_home_a") },
    { q: t("faq_addons_q"), a: t("faq_addons_a") },
    { q: t("faq_where_q"), a: t("faq_where_a") },
  ];
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h2 className="mb-8 text-center font-display text-3xl text-ink">
        {t("faq_title")}
      </h2>
      <div className="space-y-3">
        {faqs.map((f) => (
          <details
            key={f.q}
            className="rounded-md border border-ink/10 bg-bone px-4 py-3"
          >
            <summary className="cursor-pointer font-medium text-ink">{f.q}</summary>
            <p className="mt-2 text-ink/80">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
