import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { GoogleReviewsContent } from "@/components/home/GoogleReviews";
import { TikTokContent } from "@/components/home/TikTokStrip";

export async function SocialProof({ locale }: { locale: Locale }) {
  const tSP = await getTranslations("home.social_proof");
  return (
    <section aria-label={tSP("aria")} className="mx-auto max-w-[var(--container-max)] px-6 py-24 md:py-28">
      <div className="grid gap-10 md:gap-14">
        {await GoogleReviewsContent()}
        {await TikTokContent({ locale })}
      </div>
    </section>
  );
}
