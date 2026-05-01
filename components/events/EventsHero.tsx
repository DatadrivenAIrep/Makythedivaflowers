// components/events/EventsHero.tsx
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/types/locale";

export async function EventsHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "events" });
  return (
    <section className="relative min-h-[100dvh] flex items-end overflow-hidden">
      <Image
        src="https://picsum.photos/seed/diva-events-hero/2400/3000"
        alt={t("hero_alt")}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
      <div className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pb-20 pt-32 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80">{t("eyebrow")}</p>
          <h1 className="font-display text-bone text-6xl sm:text-7xl lg:text-8xl leading-[0.92] tracking-tighter">
            {t("hero_title")}
          </h1>
          <p className="text-bone/85 text-lg max-w-[52ch]">{t("hero_sub")}</p>
          <Button asChild variant="primary" size="md">
            <Link href={`/${locale}/events#inquire`}>{t("hero_cta")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
