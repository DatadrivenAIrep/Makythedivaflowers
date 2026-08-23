// components/orchids/OrchidsColors.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PRODUCTS } from "@/data/products";
import { Reveal } from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/StaggerGroup";

export async function OrchidsColors({ locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  const product = PRODUCTS.find((p) => p.slug === "phalaenopsis-orchid");
  if (!product) return null;

  return (
    <section className="bg-petal/30 text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <Reveal as="div">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
            {t("colors_eyebrow")}
          </p>
          <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
            {t("colors_title")}
          </h2>
        </Reveal>

        <StaggerGroup as="ul" className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {product.images.map((img) => (
            <StaggerItem
              as="li"
              key={img.src}
              className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-bento)] bg-bone"
            >
              <img
                src={img.src}
                alt={img.alt[locale]}
                className="absolute inset-0 size-full object-cover"
                loading="lazy"
              />
            </StaggerItem>
          ))}
        </StaggerGroup>

        <p className="mt-8 max-w-2xl font-sans text-sm leading-relaxed text-ink/75">
          {t("colors_body")}
        </p>
      </div>
    </section>
  );
}
