// components/conversion/PdpReviewsBlock.tsx
import { useTranslations } from "next-intl";
import { ElfsightReviews } from "@/components/social/ElfsightReviews";
import { ELFSIGHT_APPS } from "@/data/elfsight";
import { CONV_EVENTS } from "@/lib/conversion/events";

/**
 * Google reviews on a product page. Full width and below the buy column on
 * purpose — the widget needs room, and the add-to-bag button has to stay near
 * the top of the fold.
 */
export function PdpReviewsBlock() {
  const t = useTranslations("conversion.reviews");

  return (
    <section
      data-conv-event={CONV_EVENTS.reviews.view}
      aria-label={t("aria_section")}
      className="mx-auto max-w-[var(--container-max)] px-6 pb-16"
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {t("eyebrow")}
      </p>
      <h2 className="mt-3 font-display text-4xl leading-[0.95] tracking-tighter md:text-5xl">
        {t("title")}
      </h2>

      <div className="mt-8">
        <ElfsightReviews appId={ELFSIGHT_APPS.productReviews} />
      </div>
    </section>
  );
}
