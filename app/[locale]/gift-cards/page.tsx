import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { localeAlternates } from "@/lib/seo/alternates";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { GiftCardPurchaseForm } from "@/components/gift-cards/GiftCardPurchaseForm";
import { Grain } from "@/components/brand/Grain";
import { SITE } from "@/data/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const es = locale === "es";
  return {
    title: es
      ? "Tarjetas de Regalo | Diva Flowers · Albertson, NY"
      : "Gift Cards | Diva Flowers · Albertson, NY",
    description: es
      ? "Regala flores sin elegir por ellos. La tarjeta llega por correo con tu mensaje y se usa en cualquier pedido de nuestra floristería en Albertson."
      : "Give flowers without choosing for them. The card arrives by email with your message and works on any order from our Albertson studio.",
    alternates: localeAlternates(locale, "/gift-cards"),
  };
}

export default async function GiftCardsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("gift_cards");
  const es = locale === "es";

  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD
        items={[
          { name: es ? "Inicio" : "Home", href: `/${locale}` },
          { name: t("title"), href: `/${locale}/gift-cards` },
        ]}
      />
      <Grain />

      <header className="mx-auto max-w-[var(--container-max)] px-6 pt-16 pb-10 md:pt-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-500">
          {t("eyebrow")}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[0.98] tracking-tighter md:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-2xl font-sans text-base leading-relaxed text-ink/75">
          {t("lead")}
        </p>
      </header>

      <div className="mx-auto grid max-w-[var(--container-max)] gap-12 px-6 pb-24 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <GiftCardPurchaseForm locale={locale} />

        <aside className="h-fit rounded-2xl border border-ink/10 bg-mute-100/40 p-6">
          <h2 className="font-display text-xl tracking-tight">{t("how_title")}</h2>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed text-ink/75">
            <li>{t("how_1")}</li>
            <li>{t("how_2")}</li>
            <li>{t("how_3")}</li>
          </ol>
          <p className="mt-6 border-t border-ink/10 pt-4 font-mono text-[11px] leading-relaxed text-mute-500">
            {t("fine_print")}
          </p>
          <a
            href={SITE.phoneHref}
            className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-rouge underline-offset-4 hover:underline"
          >
            {es ? `¿Dudas? ${SITE.phoneDisplay}` : `Questions? ${SITE.phoneDisplay}`}
          </a>
        </aside>
      </div>
    </main>
  );
}
