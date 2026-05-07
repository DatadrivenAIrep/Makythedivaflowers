import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";
import { MothersDayCutoffBanner } from "@/components/mothers-day/MothersDayCutoffBanner";
import { ZipChecker } from "@/components/mothers-day/ZipChecker";
import { MothersDayEdit } from "@/components/mothers-day/MothersDayEdit";
import { WhyDivaBlock } from "@/components/mothers-day/WhyDivaBlock";
import { MothersDayFaq } from "@/components/mothers-day/MothersDayFaq";
import { StickyMobileCTA } from "@/components/mothers-day/StickyMobileCTA";
import { MothersDayProductSchema } from "@/components/mothers-day/MothersDayProductSchema";
import { MothersDayViewTracker } from "@/components/mothers-day/MothersDayViewTracker";
import { GoogleReviews } from "@/components/home/GoogleReviews";
import { PetalRain } from "@/components/home/PetalRain";
import { KineticMarquee } from "@/components/brand/KineticMarquee";

const CURATED_SLUGS = [
  "angels-touch",
  "aloha-aura",
  "blush-enchantment",
  "butterfly-kiss",
  "daydream-parcel",
  "mango-tango",
  "pastel-poetry",
  "wildflower-meadow",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "mothers_day" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: {
      canonical: `${SITE.url}/${locale}/mothers-day`,
      languages: {
        en: "/en/mothers-day",
        es: "/es/mothers-day",
      },
    },
    openGraph: {
      title: t("page_title"),
      description: t("meta_description"),
      url: `${SITE.url}/${locale}/mothers-day`,
    },
  };
}

export default async function MothersDayPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "mothers_day" });

  return (
    <main className="bg-bone text-ink">
      <MothersDayCutoffBanner
        cutoff={SITE.cutoff24}
        deadlineAt="2026-05-10T18:00:00-04:00"
        label={t("cutoff_banner")}
        ctaLabel={t("hero_cta")}
      />

      {locale === "es" && (
        <div className="bg-ink/5 py-2 text-center text-sm text-ink/70">
          {t("es_banner")}
        </div>
      )}

      {/* Editorial hero — looping video + rouge gradient + drifting petals */}
      <section className="relative isolate min-h-[88dvh] overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/hero/mothers-day-hero.jpg"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src="/hero/mothers-day-hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal/10 via-charcoal/30 to-charcoal/85" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 55% at 18% 90%, rgba(184,52,94,0.45) 0%, transparent 70%)",
            }}
          />
        </div>
        <PetalRain count={18} />

        <div className="relative mx-auto flex min-h-[88dvh] max-w-7xl flex-col justify-end px-6 pt-28 pb-16 md:pb-24 lg:px-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-bone/90 border border-bone/40 bg-charcoal/30 backdrop-blur-sm px-3 py-1.5 rounded-full inline-block self-start mb-6">
            Mother&apos;s Day · May 10
          </span>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] text-bone max-w-4xl">
            Mother&apos;s Day Flowers,
            <br />
            <em className="italic font-light text-bone/95">Long Island.</em>
          </h1>
          <p className="mt-6 max-w-xl text-bone/85 text-base md:text-lg leading-relaxed">
            {t("hero_sub")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#md-edit"
              className="inline-block rounded-full bg-bone px-7 py-3.5 text-sm font-semibold text-ink hover:bg-bone/90 transition-colors"
            >
              {t("hero_cta")}
            </a>
            <a
              href={SITE.phoneHref}
              className="inline-block rounded-full border border-bone/40 bg-charcoal/20 backdrop-blur-sm px-7 py-3.5 text-sm font-medium text-bone hover:bg-charcoal/40 transition-colors"
            >
              Call {SITE.phoneDisplay}
            </a>
          </div>
          <div className="mt-10 max-w-md">
            <span className="block text-[10px] uppercase tracking-[0.25em] text-bone/70 mb-2">
              {t("zip_label")}
            </span>
            <ZipChecker locale={locale} />
          </div>
        </div>
      </section>

      <KineticMarquee text="Mother&apos;s Day · May 10 · Order Until Sun 6 PM · Hand-Delivered · Albertson · Romance, by the stem ·  " speed={32} />

      {/* Trust strip */}
      <section className="mx-auto max-w-5xl px-4 py-12 text-center">
        <p className="font-display text-2xl md:text-3xl text-ink">{t("trust_reviews")}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] uppercase tracking-[0.22em] text-ink/55">
          {SITE.press.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      </section>

      <GoogleReviews locale={locale} />

      <section className="mx-auto max-w-7xl px-4 pt-20 pb-4 text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-rouge">The Edit</span>
        <h2 className="mt-3 font-display text-4xl md:text-5xl text-ink">{t("edit_title")}</h2>
        <p className="mt-3 text-ink/70 max-w-xl mx-auto">{t("edit_subtitle")}</p>
      </section>
      <MothersDayEdit locale={locale} slugs={CURATED_SLUGS} />

      <WhyDivaBlock locale={locale} />
      <MothersDayFaq locale={locale} />

      <StickyMobileCTA />
      <MothersDayViewTracker />
      <MothersDayProductSchema locale={locale} slugs={CURATED_SLUGS} />
    </main>
  );
}
