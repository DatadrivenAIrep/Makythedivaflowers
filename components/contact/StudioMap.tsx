// components/contact/StudioMap.tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function StudioMap({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.map" });
  return (
    <a
      href="https://maps.google.com/?q=1077+Hempstead+Tpke,+Franklin+Square,+NY"
      target="_blank"
      rel="noreferrer"
      className="block mt-8 overflow-hidden rounded-2xl group"
      aria-label={t("alt")}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src="https://picsum.photos/seed/diva-map/800/600"
          alt={t("alt")}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
        />
        <div className="absolute inset-0 flex items-end p-4">
          <span className="rounded-full bg-bone/90 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
            1077 Hempstead Tpke · Franklin Square, NY
          </span>
        </div>
      </div>
    </a>
  );
}
