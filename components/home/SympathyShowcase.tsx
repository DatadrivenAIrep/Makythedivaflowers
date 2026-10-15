import Link from "next/link";
import { FloatingPhoto } from "@/components/product/FloatingPhoto";
import type { Locale } from "@/types/locale";
import { getPricedProducts } from "@/lib/product-prices";
import { SYMPATHY_PRODUCT_SLUGS } from "@/data/sympathy-pieces";
import { pickLocalized } from "@/types/product";
import { formatMoneyCents } from "@/lib/format";
import { startingPriceCents } from "@/data/product-helpers";

const COPY = {
  eyebrow: { en: "Sympathy & memorials", es: "Pésame y memoriales" },
  title: {
    en: "For the goodbyes that matter.",
    es: "Para las despedidas que importan.",
  },
  body: {
    en: "Hearts, wreaths, crosses, and standing sprays you can order online, plus custom memorial work, delivered directly to funeral homes across Long Island and Queens.",
    es: "Corazones, coronas, cruces y tributos de pie que puedes pedir en línea, además de trabajos a medida, entregados directo a funerarias de Long Island y Queens.",
  },
  cta: { en: "See all sympathy pieces →", es: "Ver todas las piezas →" },
} as const;

export function SympathyShowcase({ locale }: { locale: Locale }) {
  const products = getPricedProducts();
  const pieces = SYMPATHY_PRODUCT_SLUGS.map((slug) =>
    products.find((p) => p.slug === slug && p.active),
  ).filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (pieces.length === 0) return null;

  return (
    <section className="overflow-hidden bg-ink/[0.97] py-20 text-bone md:py-28">
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
              {COPY.eyebrow[locale]}
            </p>
            <h2 className="mt-3 font-display text-4xl leading-[1] tracking-tighter md:text-5xl">
              {COPY.title[locale]}
            </h2>
            <p className="mt-4 font-sans text-base leading-relaxed text-bone/75">
              {COPY.body[locale]}
            </p>
          </div>
          <Link
            href={`/${locale}/sympathy`}
            className="inline-flex w-fit items-center whitespace-nowrap rounded-full border border-bone/40 px-5 py-3 font-sans text-sm tracking-tight transition-colors hover:border-bone"
          >
            {COPY.cta[locale]}
          </Link>
        </div>
      </div>

      {/* Auto-scrolling ribbon of the sympathy products. Pure CSS (see <style>
          below): loops via two identical copies translated to -50%; pauses on
          hover and keyboard focus; falls back to a manual scroll strip under
          prefers-reduced-motion. Only the first copy is reachable — the second
          exists for the seamless loop and is hidden from assistive tech. */}
      <div className="sympathy-ribbon mt-12">
        <div className="sympathy-ribbon__track flex w-max">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0" aria-hidden={copy === 1 ? true : undefined}>
              {pieces.map((p) => {
                const image = p.images[0];
                return (
                  <li key={`${copy}-${p.slug}`} className="mr-4 shrink-0">
                    <Link
                      href={`/${locale}/product/${p.slug}`}
                      tabIndex={copy === 1 ? -1 : undefined}
                      className="group block w-52 md:w-64"
                    >
                      {/* The whole piece floats on a plaster card (its own photo
                          background); name and price sit below on the dark band. */}
                      <div className="relative h-64 rounded-[var(--radius-bento)] bg-mute-100 md:h-80">
                        {image && (
                          <FloatingPhoto
                            src={image.src}
                            alt={copy === 1 ? "" : pickLocalized(image.alt, locale)}
                            sizes="(min-width: 768px) 256px, 208px"
                            className="inset-x-3 top-4 bottom-3 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1.5 motion-reduce:transform-none"
                          />
                        )}
                      </div>
                      <span className="mt-3 flex flex-col gap-1 px-1">
                        <span className="truncate font-display text-lg leading-tight text-bone">
                          {pickLocalized(p.title, locale)}
                        </span>
                        <span className="font-mono text-[11px] tracking-[0.08em] text-bone/70">
                          {formatMoneyCents(startingPriceCents(p), locale)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      </div>

      <style>{`
        .sympathy-ribbon { overflow: hidden; }
        .sympathy-ribbon__track {
          animation: sympathy-ribbon-scroll 80s linear infinite;
          will-change: transform;
        }
        .sympathy-ribbon:hover .sympathy-ribbon__track,
        .sympathy-ribbon:focus-within .sympathy-ribbon__track {
          animation-play-state: paused;
        }
        @keyframes sympathy-ribbon-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sympathy-ribbon { overflow-x: auto; }
          .sympathy-ribbon__track { animation: none; }
        }
      `}</style>
    </section>
  );
}
