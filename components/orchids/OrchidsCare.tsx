import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { ORCHID_CARE } from "@/data/orchid-care";

export async function OrchidsCare({ locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  return (
    <section className="bg-ink text-bone">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/40">
          {t("care_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
          {t("care_title")}
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
          {ORCHID_CARE.map((step, i) => (
            <li key={step.id} className="border-t border-bone/15 pt-5">
              <span className="font-mono text-[11px] tracking-[0.2em] text-bone/40">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-xl leading-snug">
                {step.title[locale]}
              </h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-bone/70">
                {step.body[locale]}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
