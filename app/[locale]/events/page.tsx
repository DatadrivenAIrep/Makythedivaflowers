// app/[locale]/events/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EventsHero } from "@/components/events/EventsHero";
import { UseCaseGrid } from "@/components/events/UseCaseGrid";
import { ProcessStrip } from "@/components/weddings/ProcessStrip";
import { EventsForm } from "@/components/inquiry/EventsForm";
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
  const t = await getTranslations({ locale, namespace: "events" });
  return (
    <main>
      <EventsHero locale={locale} />
      <UseCaseGrid locale={locale} />
      <ProcessStrip namespace="events.process" />
      <section id="inquire" className="py-24 bg-petal/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-10 max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("form.eyebrow")}</p>
            <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("form.title")}</h2>
            <p className="mt-4 text-ink/70 max-w-[58ch]">{t("form.body")}</p>
          </header>
          <EventsForm locale={locale} />
        </div>
      </section>
    </main>
  );
}
