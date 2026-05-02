import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { REVIEWS, REVIEWS_AGGREGATE, buildReviewsJsonLd } from "@/data/reviews";
import { SITE } from "@/data/site";
import { GoogleReviewsClient } from "./GoogleReviewsClient";

export async function GoogleReviews({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.reviews");

  const jsonLd = buildReviewsJsonLd(REVIEWS, REVIEWS_AGGREGATE, SITE.brand);

  return (
    <section className="py-24 md:py-32" aria-label={t("aria.section")}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <div className="max-w-[1400px] mx-auto px-6">
        <div className="rounded-[var(--radius-bento)] border border-mute-100 px-6 py-8 md:px-10 md:py-10">

          {/* HEADER ROW */}
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
                {t("eyebrow")}
              </p>
              <h2
                className="font-display text-3xl md:text-5xl tracking-tighter leading-[1.02] mt-1 mb-3"
                style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 70" }}
              >
                {t("title")}
              </h2>
              <div className="flex items-baseline gap-3">
                <span
                  className="font-display italic text-[40px] md:text-[54px] leading-none tracking-tighter"
                  style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 70" }}
                >
                  {REVIEWS_AGGREGATE.rating}
                </span>
                <span
                  className="text-rouge text-xl tracking-widest"
                  aria-label={`Rated ${REVIEWS_AGGREGATE.rating} out of 5 stars`}
                >
                  ★★★★★
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-mute-500">
                  /{REVIEWS_AGGREGATE.total}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-mute-100">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 block"
                style={{
                  background:
                    "conic-gradient(from 0deg, #4285F4 0%, #EA4335 25%, #FBBC05 50%, #34A853 75%, #4285F4 100%)",
                }}
                aria-hidden="true"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-mute-600">
                {t("verified")}
              </span>
            </div>
          </div>

          {/* ROTATING QUOTE */}
          <GoogleReviewsClient
            reviews={REVIEWS}
            locale={locale}
          />

          {/* OUTBOUND CTA */}
          <div className="mt-8 pt-6 border-t border-mute-100">
            <a
              href={REVIEWS_AGGREGATE.placeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute-500 hover:text-ink transition-colors"
            >
              → {t("read_all", { count: REVIEWS_AGGREGATE.total })}
            </a>
          </div>

        </div>
      </div>
    </section>
  );
}
