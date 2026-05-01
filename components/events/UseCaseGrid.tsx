// components/events/UseCaseGrid.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

const CASES = ["restaurants", "offices", "galleries", "private", "press", "hotels"] as const;

export async function UseCaseGrid({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "events.cases" });
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-12 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map((c, i) => (
            <li key={c} className="rounded-2xl border border-ink/10 bg-bone p-6 hover:border-rouge/40 transition-colors motion-reduce:transition-none">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-rouge">0{i + 1}</p>
              <h3 className="mt-3 font-display text-2xl text-ink">{t(`${c}.title`)}</h3>
              <p className="mt-2 text-sm text-ink/70 leading-relaxed">{t(`${c}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
