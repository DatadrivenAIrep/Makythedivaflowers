// components/social/Testimonials.tsx
import type { Review } from "@/data/reviews";
import type { Locale } from "@/types/locale";

export function Testimonials({
  reviews,
  locale,
  eyebrow,
  title,
}: {
  reviews: Review[];
  locale: Locale;
  eyebrow: string;
  title: string;
}) {
  if (reviews.length === 0) return null;

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">
            {title}
          </h2>
        </header>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-5 rounded-[var(--radius-bento)] border border-ink/10 bg-white/40 p-7"
            >
              <p className="text-base leading-relaxed text-ink/80">
                &ldquo;{r.text[locale]}&rdquo;
              </p>
              <div className="mt-auto flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-ink/[0.06] font-mono text-[11px] tracking-wider text-ink/70">
                  {r.initials}
                </span>
                <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink/60">
                  {r.author}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
