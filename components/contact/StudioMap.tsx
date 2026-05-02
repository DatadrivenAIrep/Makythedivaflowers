// components/contact/StudioMap.tsx
import { getTranslations } from "next-intl/server";
import { SITE } from "@/data/site";
import type { Locale } from "@/types/locale";

export async function StudioMap({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.map" });
  const tStudio = await getTranslations({ locale, namespace: "contact.studio" });

  return (
    <div className="mt-8 space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
        <iframe
          src={SITE.map.embedSrc}
          title={t("alt")}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
        <div className="pointer-events-none absolute inset-0 flex items-end p-4">
          <span className="rounded-full bg-bone/90 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
            {SITE.address.line1} · {SITE.address.locality}, {SITE.address.region}
          </span>
        </div>
      </div>
      <a
        href={SITE.map.directionsHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex font-mono text-[11px] uppercase tracking-[0.18em] text-ink hover:text-petal transition-colors"
      >
        {tStudio("directions_cta")} →
      </a>
    </div>
  );
}
