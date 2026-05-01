// app/[locale]/contact/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StudioInfo } from "@/components/contact/StudioInfo";
import { StudioMap } from "@/components/contact/StudioMap";
import { DeliveryZonePills } from "@/components/contact/DeliveryZonePills";
import { ContactForm } from "@/components/inquiry/ContactForm";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: { languages: { en: "/en/contact", es: "/es/contact" } },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return (
    <main className="pt-32 pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 mb-24">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
            <h1 className="mt-3 font-display text-6xl sm:text-7xl text-ink leading-[0.92] tracking-tighter mb-12">
              {t("title")}
            </h1>
            <StudioInfo locale={locale} />
            <StudioMap locale={locale} />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("form.eyebrow")}</p>
            <h2 className="mt-3 font-display text-4xl text-ink leading-[0.95] tracking-tighter mb-10">
              {t("form.title")}
            </h2>
            <ContactForm locale={locale} />
          </div>
        </div>
        <DeliveryZonePills locale={locale} />
      </div>
    </main>
  );
}
