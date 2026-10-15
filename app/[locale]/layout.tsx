import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/types/locale";
import { TopNav } from "@/components/nav/TopNav";
import { NavLinks } from "@/components/nav/NavLinks";
import { MobileNavProvider } from "@/components/nav/MobileNavProvider";
import { Footer } from "@/components/nav/Footer";
import { LocaleChrome } from "@/components/nav/LocaleChrome";
import { CartDrawerHost } from "@/components/cart/CartDrawerHost";
import { ToastAddedToBag } from "@/components/cart/ToastAddedToBag";
import { AddToBagDelight } from "@/components/cart/AddToBagDelight";
import { LocalBusinessLD } from "@/components/seo/LocalBusinessLD";
import { ContactContextProvider } from "@/components/contact/ContactContextProvider";
import { WelcomeOffer } from "@/components/conversion/WelcomeOffer";
import { TextMakyTrigger } from "@/components/contact/TextMakyTrigger";
import { PricedCatalogProvider } from "@/components/catalog/PricedCatalog";
import { getAllPriceOverrides, type PriceOverride } from "@/lib/product-prices";

function priceOverrides(): PriceOverride[] {
  try {
    return getAllPriceOverrides();
  } catch (err) {
    // Base prices beat a broken page; checkout still charges the override server-side.
    console.error("[layout] price overrides unavailable", err);
    return [];
  }
}

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
      <PricedCatalogProvider overrides={priceOverrides()}>
        <LocalBusinessLD />
        <ContactContextProvider>
          <LocaleChrome
            topNav={
              <TopNav
                locale={locale as Locale}
                navLinksSlot={<NavLinks locale={locale as Locale} />}
                mobileMenuSlot={<MobileNavProvider locale={locale as Locale} />}
              />
            }
            footer={<Footer locale={locale as Locale} />}
            extras={
              <>
                <CartDrawerHost locale={locale as Locale} />
                <ToastAddedToBag />
                <AddToBagDelight />
                <TextMakyTrigger />
                <WelcomeOffer locale={locale as Locale} />
              </>
            }
          >
            {children}
          </LocaleChrome>
        </ContactContextProvider>
      </PricedCatalogProvider>
    </NextIntlClientProvider>
  );
}
