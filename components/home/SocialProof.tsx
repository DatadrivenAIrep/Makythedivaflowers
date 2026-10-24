import { getTranslations } from "next-intl/server";
import { GoogleReviewsContent } from "@/components/home/GoogleReviews";

// The Google reviews, right after the first prices. The TikTok strip that
// used to share this block now sits with the behind-the-scenes film.
// `id="reviews"` is the target of the rating in the assurance strip.
export async function SocialProof() {
  const t = await getTranslations("home.reviews");
  return (
    <section
      id="reviews"
      aria-label={t("aria.section")}
      className="mx-auto max-w-[var(--container-max)] scroll-mt-[var(--nav-offset)] px-6 py-16 md:py-24"
    >
      {await GoogleReviewsContent()}
    </section>
  );
}
