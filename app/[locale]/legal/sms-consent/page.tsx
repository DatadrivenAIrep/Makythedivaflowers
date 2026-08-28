// app/[locale]/legal/sms-consent/page.tsx
// Public reference copy of the in-store sign-up form, so an A2P 10DLC reviewer
// can verify the SMS consent language. The consent wording is the SAME string
// the checkout consent box uses (checkout.consent_label / consent_fine).
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SITE } from "@/data/site";
import { formatAddressLine } from "@/lib/format";
import type { Locale } from "@/types/locale";

const FIELDS = ["name", "phone", "email", "birthday"] as const;

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
    alternates: { languages: { en: "/en/legal/sms-consent", es: "/es/legal/sms-consent" } },
  };
}

export default async function SmsConsentFormPage({
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
          <h1 className="mt-2 font-display text-4xl sm:text-5xl text-ink leading-[0.95] tracking-tighter">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-ink/70">{t("intro")}</p>
        </header>

        <div className="space-y-6">
          {FIELDS.map((f) => (
            <div key={f}>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
                {t(`field_${f}`)}
              </div>
              <div className="h-6 border-b border-ink/25" />
            </div>
          ))}
        </div>

        <section className="mt-10 rounded-2xl border-2 border-ink/80 p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl tracking-tight text-ink">{t("consent_heading")}</h2>
            <span className="rounded-full border border-rouge px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-rouge">
              {t("optional")}
            </span>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-6 w-6 shrink-0 rounded border-2 border-ink" aria-hidden="true" />
            <div>
              <p className="font-semibold text-ink">{tc("consent_label")}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{tc("consent_fine")}</p>
              <p className="mt-2 text-sm">
                <Link
                  href={`/${locale}/legal/terms`}
                  className="text-ink/70 underline hover:text-ink"
                >
                  {tc("consent_terms")}
                </Link>
                {" · "}
                <Link
                  href={`/${locale}/legal/privacy`}
                  className="text-ink/70 underline hover:text-ink"
                >
                  {tc("consent_privacy")}
                </Link>
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm italic text-ink/55">{t("optout_note")}</p>
        </section>

        <div className="mt-8 flex flex-col gap-6 sm:flex-row">
          <div className="flex-1">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
              {t("field_signature")}
            </div>
            <div className="h-6 border-b border-ink/25" />
          </div>
          <div className="sm:w-44">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
              {t("field_date")}
            </div>
            <div className="h-6 border-b border-ink/25" />
          </div>
        </div>

        <footer className="mt-12 border-t border-ink/10 pt-6 text-sm text-ink/55">
          {SITE.brand} · {address} · {SITE.phoneDisplay}
        </footer>
      </div>
    </main>
  );
}
