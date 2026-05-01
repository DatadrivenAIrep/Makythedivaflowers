import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home.hero");

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-bone text-ink px-6">
      <div className="space-y-6 text-center max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute-500">{t("eyebrow")}</p>
        <h1 className="font-display text-6xl md:text-8xl tracking-tighter leading-none">{t("title")}</h1>
        <p className="text-mute-600">{t("sub")}</p>
      </div>
    </main>
  );
}
