// app/[locale]/subscriptions/page.tsx
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { SubscriptionLanding } from "@/components/subscription/SubscriptionLanding";
import { SubscriptionHero } from "@/components/subscription/SubscriptionHero";
import { SubscriptionHowItWorks } from "@/components/subscription/SubscriptionHowItWorks";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subscriptions" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: {
      canonical: `/${locale}/subscriptions`,
      languages: { en: "/en/subscriptions", es: "/es/subscriptions" },
    },
  };
}

export default async function SubscriptionsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <SubscriptionLanding
        locale={locale}
        initialPlan="maison"
        hero={<SubscriptionHero locale={locale} />}
        howItWorks={<SubscriptionHowItWorks locale={locale} />}
      />
    </main>
  );
}
