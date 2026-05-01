import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { Wordmark } from "@/components/brand/Wordmark";
import { ArchSVG } from "@/components/brand/ArchSVG";
import { Grain } from "@/components/brand/Grain";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home.hero");

  return (
    <main className="min-h-[100dvh] bg-bone text-ink">
      <Grain />
      <header className="px-6 py-6">
        <Wordmark locale={locale} />
      </header>
      <section className="px-6 pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center max-w-[1400px] mx-auto">
        <div className="space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute-500">{t("eyebrow")}</p>
          <h1 className="font-display text-6xl md:text-8xl tracking-tighter leading-[0.95]">
            {t("title")}
          </h1>
          <p className="text-mute-600 max-w-[48ch]">{t("sub")}</p>
        </div>
        <div className="aspect-[4/5] text-rouge">
          <ArchSVG className="size-full">
            <img
              alt=""
              src="https://picsum.photos/seed/diva-hero/900/1100"
              className="size-full object-cover"
            />
          </ArchSVG>
        </div>
      </section>
    </main>
  );
}
