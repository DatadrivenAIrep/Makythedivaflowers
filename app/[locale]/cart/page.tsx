import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CartPageList } from "@/components/cart/CartPageList";
import type { Locale } from "@/types/locale";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: {
      languages: { en: "/en/cart", es: "/es/cart" },
    },
  };
}

export default async function CartPage({
  params,
}: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <header className="mb-10 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("page_eyebrow")}</p>
        <h1 className="mt-3 font-display text-5xl sm:text-6xl text-ink leading-[0.95] tracking-tighter">
          {t("page_title")}
        </h1>
      </header>
      <CartPageList locale={locale} />
    </main>
  );
}
