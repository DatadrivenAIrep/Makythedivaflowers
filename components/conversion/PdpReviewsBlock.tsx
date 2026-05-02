// components/conversion/PdpReviewsBlock.tsx
import { useTranslations } from "next-intl";
import { REVIEWS, REVIEWS_AGGREGATE } from "@/data/reviews";
import { matchReviews } from "@/lib/conversion/reviews-match";
import { CONV_EVENTS } from "@/lib/conversion/events";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";

type Props = {
  product: Product;
  locale: Locale;
};

export function PdpReviewsBlock({ product, locale: _locale }: Props) {
  const t = useTranslations("conversion.reviews");
  const match = matchReviews(REVIEWS, REVIEWS_AGGREGATE, product.occasions);

  const aggregateText = match.usedFallback || !match.occasionLabelKey
    ? t("rating_aggregate", { rating: match.aggregateRating, total: match.aggregateCount })
    : t("rating_aggregate_matched", {
        rating: match.aggregateRating,
        count: match.matchedCount,
        occasion: t(match.occasionLabelKey),
      });

  return (
    <section
      data-conv-event={CONV_EVENTS.reviews.view}
      aria-label="Customer reviews"
      className="rounded-2xl border border-ink/10 bg-bone/40 p-5"
    >
      <header className="flex items-baseline gap-3">
        <span aria-label={`Rated ${match.aggregateRating} out of 5 stars`} className="text-rouge tracking-widest">
          ★★★★★
        </span>
        <p className="font-mono text-xs text-ink/80">{aggregateText}</p>
      </header>
      <ul className="mt-4 space-y-3">
        {match.matched.map((r) => (
          <li key={r.id}>
            <blockquote className="text-sm text-ink/85 italic leading-snug">
              &ldquo;{r.quote}&rdquo;
              <cite className="not-italic block mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
                — {r.author}
              </cite>
            </blockquote>
          </li>
        ))}
      </ul>
      <a
        href={REVIEWS_AGGREGATE.placeUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-rouge hover:underline"
      >
        {t("read_all_cta", { count: match.aggregateCount })}
      </a>
    </section>
  );
}
