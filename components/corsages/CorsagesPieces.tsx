// components/corsages/CorsagesPieces.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { CORSAGE_PIECES, FLOWER_GRADIENT } from "@/data/corsages-collection";
import { CorsagesOpenModalButton } from "./CorsagesOpenModalButton";
import { cn } from "@/lib/cn";

export async function CorsagesPieces({ locale }: { locale: Locale }) {
  const t = await getTranslations("corsages");
  return (
    <section className="bg-bone text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-28">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("pieces_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-6xl tracking-tighter leading-[0.95]">
          {t("pieces_title")}
        </h2>

        <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {CORSAGE_PIECES.map((piece) => (
            <li
              key={piece.id}
              id={piece.id}
              className="scroll-mt-24 rounded-[var(--radius-bento)] overflow-hidden bg-petal"
            >
              <div
                className={cn(
                  "relative aspect-[4/5] overflow-hidden",
                  FLOWER_GRADIENT[piece.flower],
                )}
              >
                <img
                  src={piece.image.src}
                  alt={piece.image.alt[locale]}
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display italic text-2xl leading-tight">
                    {piece.name[locale]}
                  </h3>
                  <span className="font-mono text-base font-semibold whitespace-nowrap">
                    ${piece.priceUSD}
                  </span>
                </div>
                <p className="font-sans text-sm text-ink/80 leading-relaxed">
                  {piece.description[locale]}
                </p>
                <div className="mt-1">
                  <CorsagesOpenModalButton variant="ghost">
                    {t("reserve_this")}
                  </CorsagesOpenModalButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
