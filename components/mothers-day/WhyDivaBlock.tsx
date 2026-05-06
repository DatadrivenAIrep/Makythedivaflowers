import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function WhyDivaBlock({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "mothers_day" });
  const items = [
    { title: t("why_real_title"), body: t("why_real_body") },
    { title: t("why_delivery_title"), body: t("why_delivery_body") },
    { title: t("why_cutoff_title"), body: t("why_cutoff_body") },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <h2 className="mb-10 text-center font-display text-3xl text-ink">
        {t("why_title")}
      </h2>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.title}>
            <h3 className="mb-2 font-display text-xl text-ink">{it.title}</h3>
            <p className="text-ink/80">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
