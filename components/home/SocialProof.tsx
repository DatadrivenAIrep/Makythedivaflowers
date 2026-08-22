import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { GoogleReviewsContent } from "@/components/home/GoogleReviews";
import { TikTokContent } from "@/components/home/TikTokStrip";

export async function SocialProof({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.reviews");
  return (
    <section aria-label={t("aria.section")} className="mx-auto max-w-[var(--container-max)] px-6 py-24 md:py-28">
      <div className="grid gap-10 md:gap-14">
        <GoogleReviewsContent locale={locale} />
        <TikTokContent locale={locale} />
      </div>
    </section>
  );
}
