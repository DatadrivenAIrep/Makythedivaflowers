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

const CURATED_SLUGS = [
  "blush-enchantment",
  "dona-rosita",
  "cottage-garden-charm",
  "pink-opus",
  "designers-choice-maky",
  "maison-de-diva",
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
      <MothersDayCutoffBanner cutoff={SITE.cutoff24} label={t("cutoff_banner")} ctaLabel={t("hero_cta")} />

      {locale === "es" && (
        <div className="bg-ink/5 py-2 text-center text-sm text-ink/70">
          {t("es_banner")}
        </div>
      )}

      <section className="mx-auto max-w-5xl px-4 pt-16 pb-10 text-center">
        <h1 className="font-display text-4xl md:text-5xl">{t("hero_h1")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-ink/80">{t("hero_sub")}</p>
        <a
          href="#md-edit"
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-bone hover:bg-ink/90"
        >
          {t("hero_cta")}
        </a>
        <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink/60">{t("zip_label")}</span>
          <ZipChecker locale={locale} />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-6 text-center">
        <p className="text-sm text-ink/70">{t("trust_reviews")}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-wider text-ink/50">
          {SITE.press.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      </section>

      <GoogleReviews locale={locale} />

      <section className="mx-auto max-w-7xl px-4 pt-16 pb-2 text-center">
        <h2 className="font-display text-3xl text-ink">{t("edit_title")}</h2>
        <p className="mt-2 text-ink/70">{t("edit_subtitle")}</p>
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
