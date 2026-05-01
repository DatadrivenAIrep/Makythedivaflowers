import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SITE } from "@/data/site";
import { Wordmark } from "@/components/brand/Wordmark";
import type { Locale } from "@/types/locale";

export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-bone mt-32">
      <div className="max-w-[1400px] mx-auto px-6 pt-20 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-bone/10">
          <div className="md:col-span-5 space-y-6">
            <Wordmark locale={locale} className="text-bone text-3xl" />
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
            <a href={SITE.phoneHref} className="font-mono text-[13px] hover:text-petal transition-colors">
              {SITE.phoneDisplay}
            </a>
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
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-8 text-bone/50 text-xs font-mono">
          <p>
            © {year} Diva Flowers · {t("rights")}
          </p>
          <div className="flex gap-6">
            <Link href={`/${locale}/legal/privacy`} className="hover:text-bone transition-colors">
              {t("legal.privacy")}
            </Link>
            <Link href={`/${locale}/legal/terms`} className="hover:text-bone transition-colors">
              {t("legal.terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
