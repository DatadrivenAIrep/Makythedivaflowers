import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";

export async function OrchidsCTA({ locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  return (
    <section className="bg-bone text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("cta_eyebrow")}
        </p>
        <h2 className="mt-3 max-w-2xl font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
          {t("cta_title")}
        </h2>
        <p className="mt-4 max-w-xl font-sans text-sm leading-relaxed text-ink/75">
          {t("cta_body")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/product/phalaenopsis-orchid`}
            className="rounded-full bg-ink px-6 py-3 font-sans text-sm text-bone transition-opacity hover:opacity-85"
          >
            {t("cta_button")}
          </Link>
          <a
            href={SITE.phoneHref}
            className="rounded-full border border-ink/25 px-6 py-3 font-sans text-sm transition-colors hover:bg-ink hover:text-bone"
          >
            {t("cta_call")}
          </a>
        </div>
      </div>
    </section>
  );
}
