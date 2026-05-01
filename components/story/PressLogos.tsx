// components/story/PressLogos.tsx
import { getTranslations } from "next-intl/server";
import { pressMentions } from "@/data/press";
import type { Locale } from "@/types/locale";

export async function PressLogos({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "story.press" });
  return (
    <section className="py-24 border-t border-ink/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60 mb-12">{t("eyebrow")}</p>
        <ul className="flex flex-wrap gap-6 items-baseline">
          {pressMentions.map((mention) => (
            <li key={mention.id}>
              <a
                href={mention.url}
                className="font-display text-3xl sm:text-4xl text-ink/30 hover:text-ink transition-colors leading-none tracking-tighter"
                target="_blank"
                rel="noreferrer"
              >
                {mention.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
