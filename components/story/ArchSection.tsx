// components/story/ArchSection.tsx
import { getTranslations } from "next-intl/server";
import { Figure } from "@/components/editorial/Figure";
import type { Locale } from "@/types/locale";

export async function ArchSection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "story.arch" });
  return (
    <section className="py-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header className="mb-12 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
      </header>
      <div className="prose-like space-y-6 text-base sm:text-lg text-ink/80 leading-relaxed max-w-[68ch]">
        <Figure
          src="https://picsum.photos/seed/diva-arch-story/1600/2000"
          alt={t("figure_alt")}
          aspect="4/5"
          align="right"
        />
        <p>{t("p1")}</p>
        <p>{t("p2")}</p>
        <p>{t("p3")}</p>
      </div>
    </section>
  );
}
