// components/home/Verticals.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { VerticalTeaser } from "@/components/home/VerticalTeaser";

export async function Verticals({ locale }: { locale: Locale }) {
  const w = await getTranslations("home.weddings_teaser");
  const e = await getTranslations("home.events_teaser");
  return (
    <section className="mx-auto max-w-[var(--container-max)] px-6 py-16">
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <VerticalTeaser
          eyebrow={w("eyebrow")} title={w("title")} cta={w("cta")}
          imageSrc="/weddings/oh1-scaled.webp"
          href={`/${locale}/weddings`}
        />
        <VerticalTeaser
          eyebrow={e("eyebrow")} title={e("title")} cta={e("cta")}
          imageSrc="/events/evento-01/p01.webp"
          href={`/${locale}/events`}
        />
      </div>
    </section>
  );
}
