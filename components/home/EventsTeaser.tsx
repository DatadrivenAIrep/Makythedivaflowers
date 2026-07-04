// components/home/EventsTeaser.tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Locale } from "@/types/locale";

export async function EventsTeaser({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.events_teaser");
  return (
    <section className="relative py-16">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="relative overflow-hidden rounded-[var(--radius-bento)] aspect-[16/9] md:aspect-[21/9]">
          {/* Real Diva event (bridal shower). TODO: swap for a corporate-event photo when available. */}
          <img
            alt=""
            src="/weddings/dani-bridal-shower-jun-2026/7247.webp"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/20 to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-8 md:p-14 text-bone">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80">
              {t("eyebrow")}
            </p>
            <h2 className="font-display text-4xl md:text-6xl tracking-tighter leading-[0.98] mt-3 max-w-[16ch]">
              {t("title")}
            </h2>
            <Link
              href={`/${locale}/events`}
              className="mt-6 inline-flex w-fit font-sans text-sm tracking-tight px-5 py-3 rounded-full border border-bone/40 hover:border-bone/100 transition-colors"
            >
              {t("cta")} →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
