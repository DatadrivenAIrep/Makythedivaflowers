import { getTranslations } from "next-intl/server";
import { REVIEWS, REVIEWS_AGGREGATE, buildReviewsJsonLd } from "@/data/reviews";
import { SITE } from "@/data/site";
import { ElfsightReviews } from "@/components/social/ElfsightReviews";
import { ELFSIGHT_APPS } from "@/data/elfsight";

export async function GoogleReviews() {
  const t = await getTranslations("home.reviews");

  return (
    <section className="pt-24 pb-0 md:pt-32 md:pb-0" aria-label={t("aria.section")}>
      <div className="max-w-[1400px] mx-auto px-6">
        {await GoogleReviewsContent()}
      </div>
    </section>
  );
}

export async function GoogleReviewsContent() {
  const t = await getTranslations("home.reviews");

  // The Elfsight widget paints client-side, so crawlers never see the review
  // bodies inside it. This block keeps emitting the same markup Google has
  // been indexing all along, attached to the Florist node in LocalBusinessLD.
  const jsonLd = buildReviewsJsonLd(REVIEWS, REVIEWS_AGGREGATE, SITE.merchantName, SITE.ld.businessId);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <div className="rounded-[var(--radius-bento)] border border-mute-100 px-6 py-8 md:px-10 md:py-10">

        {/* HEADER — the rating, count and outbound link all live inside the
            widget now, so the section only carries the studio's own titling. */}
        <div className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h2
            className="font-display text-3xl md:text-5xl tracking-tighter leading-[1.02] mt-1"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 70" }}
          >
            {t("title")}
          </h2>
        </div>

        <ElfsightReviews appId={ELFSIGHT_APPS.siteReviews} />

      </div>
    </>
  );
}
