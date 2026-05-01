import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { Grain } from "@/components/brand/Grain";
import { Hero } from "@/components/home/Hero";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="bg-bone text-ink">
      <Grain />
      <Hero locale={locale} />
    </main>
  );
}
