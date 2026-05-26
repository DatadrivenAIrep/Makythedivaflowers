import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/types/locale";
import { PRODUCTS } from "@/data/products";
import { pickLocalized } from "@/types/product";
import { formatMoneyCents } from "@/lib/format";
import { startingPriceCents } from "@/data/product-helpers";

const COPY = {
  eyebrow: { en: "For the smaller gesture", es: "Para el gesto más pequeño" },
  title: {
    en: "Pieces you can send today.",
    es: "Piezas que puedes enviar hoy.",
  },
  body: {
    en: "Smaller sympathy gifts you can order online — for the friend, the colleague, the neighbor. Same-day delivery on Long Island when ordered before 2pm.",
    es: "Detalles de pésame más pequeños que puedes pedir en línea — para la amiga, la colega, la vecina. Entrega el mismo día en Long Island antes de las 2pm.",
  },
  from: { en: "From", es: "Desde" },
  view: { en: "View", es: "Ver" },
} as const;

const SMALLER_SLUGS = ["celestial-peace", "monstera-mood"];

export function SympathySmallerPieces({ locale }: { locale: Locale }) {
  const items = SMALLER_SLUGS.map((slug) => PRODUCTS.find((p) => p.slug === slug)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );
  if (items.length === 0) return null;

  return (
    <section className="bg-bone py-20 md:py-24">
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <header className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
            {COPY.eyebrow[locale]}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-[1] tracking-tighter text-ink md:text-5xl">
            {COPY.title[locale]}
          </h2>
          <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-ink/75">
            {COPY.body[locale]}
          </p>
        </header>
        <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {items.map((p) => {
            const image = p.images[0];
            const from = formatMoneyCents(startingPriceCents(p), locale);
            return (
              <li
                key={p.id}
                className="group overflow-hidden rounded-[var(--radius-bento)] border border-ink/10 bg-bone"
              >
                <Link href={`/${locale}/product/${p.slug}`} className="block">
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-mute-100">
                    {image && (
                      <Image
                        src={image.src}
                        alt={pickLocalized(image.alt, locale)}
                        fill
                        sizes="(min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    )}
                  </div>
                  <div className="flex items-baseline justify-between p-6">
                    <h3 className="font-display text-2xl leading-tight tracking-tight text-ink">
                      {pickLocalized(p.title, locale)}
                    </h3>
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute-500">
                      {COPY.from[locale]} {from}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
