import type { Locale } from "@/types/locale";
import { Reveal } from "@/components/motion/Reveal";
import type { LocalOccasion } from "@/data/local-seo";

/**
 * The occasion guidance. This is the part that has to be worth reading on its
 * own — a page that only repeats "we deliver X to Y" is a doorway page.
 */
export function LocalGuidance({ locale, occasion }: { locale: Locale; occasion: LocalOccasion }) {
  return (
    <section className="border-t border-ink/10 bg-bone">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-28">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          {occasion.guidance.map((g, i) => (
            <Reveal key={g.heading.en} delay={i * 0.06}>
              <article className="max-w-xl">
                <h3 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
                  {g.heading[locale]}
                </h3>
                <p className="mt-4 font-sans text-base leading-relaxed text-ink/75">
                  {g.body[locale]}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
