// components/contact/StudioMap.tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { SITE } from "@/data/site";
import { formatAddressLine } from "@/lib/format";
import type { Locale } from "@/types/locale";

export async function StudioMap({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.map" });
  const fullAddress = formatAddressLine(SITE.address);
  const pillAddress = `${SITE.address.line1} · ${SITE.address.locality}, ${SITE.address.region}`;
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`;
  return (
    <a
      href={mapsHref}
      target="_blank"
      rel="noreferrer"
      className="block mt-8 overflow-hidden rounded-2xl group"
      aria-label={t("alt", { address: fullAddress })}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src="https://picsum.photos/seed/diva-map/800/600"
          alt={t("alt", { address: fullAddress })}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
        />
        <div className="absolute inset-0 flex items-end p-4">
          <span className="rounded-full bg-bone/90 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
            {pillAddress}
          </span>
        </div>
      </div>
    </a>
  );
}
