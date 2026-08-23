// components/orchids/OrchidsWhy.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { Reveal } from "@/components/motion/Reveal";

export async function OrchidsWhy({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  return (
    <section className="bg-ink text-bone">
      <Reveal as="div" className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/40">
          {t("why_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
          {t("why_title")}
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="border-t border-bone/15 pt-5">
            <p className="font-sans text-sm text-bone/60">{t("why_cut_label")}</p>
            <p className="mt-2 font-display text-5xl tracking-tighter text-bone/50">
              {t("why_cut_value")}
            </p>
          </div>
          <div className="border-t border-petal/60 pt-5">
            <p className="font-sans text-sm text-petal">{t("why_orchid_label")}</p>
            <p className="mt-2 font-display text-5xl tracking-tighter">
              {t("why_orchid_value")}
            </p>
          </div>
        </div>

        <p className="mt-10 max-w-2xl font-sans text-sm leading-relaxed text-bone/70 md:text-base">
          {t("why_body")}
        </p>
      </Reveal>
    </section>
  );
}
