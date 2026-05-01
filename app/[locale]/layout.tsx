import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/types/locale";
import { TopNav } from "@/components/nav/TopNav";
import { NavLinks } from "@/components/nav/NavLinks";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  return (
    <NextIntlClientProvider locale={locale}>
      <TopNav locale={locale as Locale} navLinksSlot={<NavLinks locale={locale as Locale} />} />
      <div className="pt-16">{children}</div>
    </NextIntlClientProvider>
  );
}
