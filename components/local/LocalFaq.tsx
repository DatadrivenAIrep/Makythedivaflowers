import type { Locale } from "@/types/locale";
import { Reveal } from "@/components/motion/Reveal";
import type { LocalCity, LocalOccasion } from "@/data/local-seo";
import { buildLocalFaq } from "@/lib/seo/local-faq";

/**
 * The same Q&A pairs that go into the FAQPage schema, rendered visibly.
 * Schema-only FAQ markup that has no on-page counterpart is against Google's
 * structured-data guidelines and does nothing for the person reading the page.
 */
export function LocalFaq({
  locale,
  city,
  occasion,
}: {
  locale: Locale;
  city: LocalCity;
  occasion?: LocalOccasion;
}) {
  const faq = buildLocalFaq(locale, city, occasion);
  const es = locale === "es";
  return (
    <section className="border-t border-ink/10">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <Reveal>
          <h2 className="font-display text-3xl leading-tight tracking-tight md:text-4xl">
            {es ? `Preguntas frecuentes — ${city.name}` : `Common questions — ${city.name}`}
          </h2>
          <dl className="mt-10 grid gap-8 md:grid-cols-2 md:gap-x-16">
            {faq.map((f) => (
              <div key={f.q} className="max-w-xl">
                <dt className="font-sans text-base font-medium text-ink">{f.q}</dt>
                <dd className="mt-2 font-sans text-base leading-relaxed text-ink/70">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
