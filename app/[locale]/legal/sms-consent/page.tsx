// app/[locale]/legal/sms-consent/page.tsx
// Public reference of the website SMS opt-in, so an A2P 10DLC reviewer can
// verify the consent language. Transactional and marketing consent are two
// SEPARATE, independent, optional checkboxes — the same ones shown at checkout
// (checkout.consent_transactional_label / consent_marketing_label / consent_fine).
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SITE } from "@/data/site";
import { formatAddressLine } from "@/lib/format";
import type { Locale } from "@/types/locale";
import { localeAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.sms_consent" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: localeAlternates(locale, "/legal/sms-consent"),
  };
}

export default async function SmsConsentPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.sms_consent" });
  const tc = await getTranslations({ locale, namespace: "checkout" });
  const address = formatAddressLine(SITE.address);

  return (
    <main className="pt-32 pb-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 border-b border-ink/10 pb-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-rouge">{t("eyebrow")}</p>
          <h1 className="mt-2 font-display text-4xl leading-[0.95] tracking-tighter text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-ink/70">{t("intro")}</p>
        </header>

        <form className="rounded-2xl border-2 border-ink/80 p-5 sm:p-6">
          <h2 className="mb-5 font-display text-2xl tracking-tight text-ink">{tc("consent_heading")}</h2>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="block">
              <label
                htmlFor="sms-optin-phone"
                className="mb-1 block font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50"
              >
                {t("field_phone")}
              </label>
              <input
                id="sms-optin-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="(516) 555-0123"
                className="w-full rounded-lg border border-ink/25 bg-white px-3 py-2 text-sm text-ink"
              />
            </div>
            <div className="block">
              <label
                htmlFor="sms-optin-email"
                className="mb-1 block font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50"
              >
                {t("field_email")}
              </label>
              <input
                id="sms-optin-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-ink/25 bg-white px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label htmlFor="sms-optin-transactional" className="flex items-start gap-3">
              <input
                id="sms-optin-transactional"
                name="sms_transactional"
                type="checkbox"
                className="mt-0.5 h-6 w-6 shrink-0 accent-rouge"
              />
              <span className="text-sm text-ink">{tc("consent_transactional_label")}</span>
            </label>
            <label htmlFor="sms-optin-marketing" className="flex items-start gap-3">
              <input
                id="sms-optin-marketing"
                name="sms_marketing"
                type="checkbox"
                className="mt-0.5 h-6 w-6 shrink-0 accent-rouge"
              />
              <span className="text-sm text-ink">{tc("consent_marketing_label")}</span>
            </label>
          </div>

          <p className="mt-5 border-t border-ink/10 pt-4 text-sm leading-relaxed text-ink/70">
            {tc("consent_fine")}{" "}
            <Link href={`/${locale}/legal/terms`} className="text-ink/70 underline hover:text-ink">
              {tc("consent_terms")}
            </Link>
            {" · "}
            <Link href={`/${locale}/legal/privacy`} className="text-ink/70 underline hover:text-ink">
              {tc("consent_privacy")}
            </Link>
          </p>
        </form>

        <p className="mt-6 text-sm italic text-ink/55">{t("optout_note")}</p>

        <footer className="mt-12 border-t border-ink/10 pt-6 text-sm text-ink/55">
          {SITE.brand} · {address} · {SITE.phoneDisplay}
        </footer>
      </div>
    </main>
  );
}
