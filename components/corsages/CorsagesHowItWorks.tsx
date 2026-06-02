// components/corsages/CorsagesHowItWorks.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function CorsagesHowItWorks({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("corsages");
  const steps = [
    { n: "01", title: t("how_step1_title"), body: t("how_step1_body") },
    { n: "02", title: t("how_step2_title"), body: t("how_step2_body") },
    { n: "03", title: t("how_step3_title"), body: t("how_step3_body") },
  ];
  return (
    <section className="bg-ink text-bone">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/40">
          {t("how_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
          {t("how_title")}
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="border-t border-bone/15 pt-5">
              <span className="font-mono text-[11px] tracking-[0.2em] text-bone/40">
                {s.n}
              </span>
              <h3 className="mt-2 font-display text-xl leading-snug">
                {s.title}
              </h3>
              <p className="mt-2 font-sans text-sm text-bone/70 leading-relaxed">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
