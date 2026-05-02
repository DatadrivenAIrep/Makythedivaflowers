import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { BloomImage } from "@/components/motion/BloomImage";

export async function EditorialSplit({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("home.editorial_split");
  return (
    <section className="pt-12 pb-24 md:pt-16 md:pb-32">
      <div className="max-w-[1400px] mx-auto px-6 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-5 space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h2
            className="font-display text-4xl md:text-6xl tracking-tighter leading-[1.02]"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 70" }}
          >
            {t("title")}
          </h2>
          <p className="text-mute-600 max-w-[42ch] text-base leading-relaxed">{t("body")}</p>
        </div>
        <div className="md:col-span-7 md:-mr-6 md:translate-y-6">
          <BloomImage
            src="/storefront.webp"
            alt="Diva Flowers storefront with floral arch"
            className="aspect-[4/3] rounded-[var(--radius-bento)]"
            imgClassName="object-[center_20%]"
          />
        </div>
      </div>
    </section>
  );
}
