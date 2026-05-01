// components/story/FounderPortrait.tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function FounderPortrait({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "story.founder" });
  return (
    <section className="py-20 bg-petal/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-bone relative">
            <Image
              src="https://picsum.photos/seed/diva-founder/1200/1600"
              alt={t("portrait_alt")}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="space-y-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
            <h2 className="font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
            <p className="text-base sm:text-lg text-ink/80 leading-relaxed max-w-[58ch]">{t("body")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
