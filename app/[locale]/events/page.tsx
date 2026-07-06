// app/[locale]/events/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ServiceLD } from "@/components/seo/ServiceLD";
import { EventsHero } from "@/components/events/EventsHero";
import { UseCaseGrid } from "@/components/events/UseCaseGrid";
import { PortfolioGallery } from "@/components/portfolio/PortfolioGallery";
import { eventProjects } from "@/data/event-projects";
import { ProcessStrip } from "@/components/weddings/ProcessStrip";
import { EventsForm } from "@/components/inquiry/EventsForm";
import { WhatHappensNext } from "@/components/inquiry/WhatHappensNext";
import { Testimonials } from "@/components/social/Testimonials";
import { generalReviews } from "@/data/review-helpers";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "events" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: { languages: { en: "/en/events", es: "/es/events" } },
  };
}

export default async function EventsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const tt = await getTranslations({ locale, namespace: "events.testimonials" });
  const tn = await getTranslations({ locale, namespace: "events.next_steps" });
  const te = await getTranslations({ locale, namespace: "events" });
  return (
    <main>
      <ServiceLD
        name={te("service_name")}
        description={te("service_desc")}
        serviceType="Event Florals"
      />
      <EventsHero locale={locale} />
      <UseCaseGrid locale={locale} />
      <PortfolioGallery events={eventProjects} namespace="events.portfolio" locale={locale} />
      <Testimonials
        reviews={generalReviews().slice(0, 3)}
        locale={locale}
        eyebrow={tt("eyebrow")}
        title={tt("title")}
      />
      <ProcessStrip namespace="events.process" />
      <section id="inquire" className="py-24">
        <WhatHappensNext
          title={tn("title")}
          steps={[tn("step1"), tn("step2"), tn("step3")]}
        />
        <EventsForm locale={locale} />
      </section>
    </main>
  );
}
