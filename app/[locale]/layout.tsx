import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/types/locale";
import { TopNav } from "@/components/nav/TopNav";
import { NavLinks } from "@/components/nav/NavLinks";
import { MobileNavProvider } from "@/components/nav/MobileNavProvider";
import { Footer } from "@/components/nav/Footer";
import { CartDrawerHost } from "@/components/cart/CartDrawerHost";
import { ToastAddedToBag } from "@/components/cart/ToastAddedToBag";
import { LocalBusinessLD } from "@/components/seo/LocalBusinessLD";
import { ContactContextProvider } from "@/components/contact/ContactContextProvider";
import { TextMakyTrigger } from "@/components/contact/TextMakyTrigger";

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
      <LocalBusinessLD />
      <TopNav locale={locale as Locale} navLinksSlot={<NavLinks locale={locale as Locale} />} />
      <div className="pt-16">{children}</div>
      <Footer locale={locale as Locale} />
      <CartDrawerHost locale={locale as Locale} />
      <ToastAddedToBag />
      <ContactContextProvider>
        <TopNav
          locale={locale as Locale}
          navLinksSlot={<NavLinks locale={locale as Locale} />}
          mobileMenuSlot={<MobileNavProvider locale={locale as Locale} />}
        />
        <div className="pt-16">{children}</div>
        <Footer locale={locale as Locale} />
        <CartDrawerHost locale={locale as Locale} />
        <ToastAddedToBag />
        <TextMakyTrigger />
      </ContactContextProvider>
    </NextIntlClientProvider>
  );
}
