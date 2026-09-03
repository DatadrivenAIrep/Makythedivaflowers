import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/data/site";
import { NewsletterField } from "@/components/inquiry/NewsletterField";
import { TextMakyInlineLink } from "@/components/contact/TextMakyInlineLink";
import { TelLink } from "@/components/analytics/TelLink";
import { LOCAL_CITIES } from "@/data/local-seo";
import { PrivacyOptOutLink } from "@/components/analytics/PrivacyOptOutLink";
import type { Locale } from "@/types/locale";

export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const year = new Date().getFullYear();

  return (
    <footer data-site-footer className="bg-ink text-bone mt-32">
      <div className="max-w-[1400px] mx-auto px-6 pt-20 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-bone/10">
          <div className="md:col-span-5 space-y-6">
            <Link href={`/${locale}`} aria-label="Maky the Diva Flowers — Home">
              <Image
                src="/apple-icon.webp"
                alt="Maky the Diva Flowers"
                width={96}
                height={96}
                className="h-20 w-20 rounded-2xl"
              />
            </Link>
            <p className="text-bone/70 max-w-[40ch] text-sm leading-relaxed">
              {SITE.address.line1} · {SITE.address.locality}, {SITE.address.region} {SITE.address.postal}
            </p>
          </div>

          <div className="md:col-span-2 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50">
              {t("hours_label")}
            </p>
            <ul className="space-y-1.5 font-mono text-[13px]">
              {SITE.hours.map((h) => (
                <li key={h.day}>
                  <span className="text-bone/50">{h.day}</span> <span>{h.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50">
              {t("phone_label")}
            </p>
            <TelLink
              href={SITE.phoneHref}
              location="footer"
              className="font-mono text-[13px] hover:text-petal transition-colors"
            >
              {SITE.phoneDisplay}
            </TelLink>
            <TextMakyInlineLink className="block pt-1.5 text-bone/60 hover:text-petal" />

            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50 pt-3">
              {t("email_label")}
            </p>
            <a href={SITE.emailHref} className="font-mono text-[13px] hover:text-petal transition-colors">
              {SITE.email}
            </a>
          </div>

          <div className="md:col-span-3 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50">
              {t("social_label")}
            </p>
            <ul className="space-y-1.5 text-sm">
              {SITE.social.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noreferrer" className="hover:text-petal transition-colors">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="pt-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50 mb-3">
                {t("newsletter_label")}
              </p>
              <NewsletterField locale={locale} />
            </div>
          </div>
        </div>

        {/* Towns we serve. Sitewide internal links are what get the local
            landing pages crawled at all — and they put the town names on every
            page of the site, which is exactly how the competition ranks. */}
        <nav
          aria-label={locale === "es" ? "Pueblos que servimos" : "Towns we serve"}
          className="border-t border-bone/10 pt-8"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50">
            {locale === "es" ? "Entrega de flores en" : "Flower delivery in"}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-bone/55">
            {LOCAL_CITIES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/${locale}/flower-delivery/${c.slug}`}
                  className="hover:text-bone transition-colors"
                >
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={`/${locale}/flower-delivery`}
                className="text-bone/80 hover:text-bone transition-colors"
              >
                {locale === "es" ? "Ver todos →" : "See all →"}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex flex-col gap-4 pt-8">
          <div className="flex flex-wrap gap-6 font-mono text-[11px] uppercase tracking-[0.18em] text-bone/55">
            <Link href={`/${locale}/gift-cards`} className="hover:text-bone transition-colors">{tNav("gift_cards")}</Link>
            <Link href={`/${locale}/orchids`} className="hover:text-bone transition-colors">{tNav("orchids")}</Link>
            <Link href={`/${locale}/journal`} className="hover:text-bone transition-colors">{tNav("journal")}</Link>
            <Link href={`/${locale}/contact`} className="hover:text-bone transition-colors">{tNav("contact")}</Link>
            <Link href={`/${locale}/legal/privacy`} className="hover:text-bone transition-colors">{t("legal.privacy")}</Link>
            <Link href={`/${locale}/legal/terms`} className="hover:text-bone transition-colors">{t("legal.terms")}</Link>
            <Link href={`/${locale}/legal/returns`} className="hover:text-bone transition-colors">{t("legal.returns")}</Link>
            <Link href={`/${locale}/legal/shipping`} className="hover:text-bone transition-colors">{t("legal.shipping")}</Link>
            <PrivacyOptOutLink className="hover:text-bone transition-colors" />
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-bone/50 text-xs font-mono">
            <p>
              © {year} Diva Flowers · {t("rights")}
            </p>
            <p className="text-bone/40">{t("produced_by")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
