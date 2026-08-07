import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types/locale";
import { SYMPATHY_PIECES } from "@/data/sympathy-pieces";

const COPY = {
  eyebrow: { en: "Sympathy & memorials", es: "Pésame y memoriales" },
  title: {
    en: "For the goodbyes that matter.",
    es: "Para las despedidas que importan.",
  },
  body: {
    en: "Custom funeral and memorial work, delivered directly to funeral homes across Long Island and Queens.",
    es: "Arreglos funerarios y memoriales a medida, entregados directo a funerarias de Long Island y Queens.",
  },
  cta: { en: "Arrange a tribute →", es: "Coordinar un tributo →" },
} as const;

export function SympathyShowcase({ locale }: { locale: Locale }) {
  if (SYMPATHY_PIECES.length === 0) return null;

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

      {/* Decorative auto-scrolling ribbon. Pure CSS (see <style> below): loops via
          two identical copies translated to -50%; pauses on hover; and falls back
          to a manual scroll strip under prefers-reduced-motion. */}
      <div className="sympathy-ribbon mt-12" aria-hidden="true">
        <div className="sympathy-ribbon__track flex w-max">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0">
              {SYMPATHY_PIECES.map((piece) => (
                <div
                  key={`${copy}-${piece.slug}`}
                  className="relative mr-4 h-64 w-52 shrink-0 overflow-hidden rounded-[var(--radius-bento)] border border-bone/10 md:h-80 md:w-64"
                >
                  <Image
                    src={piece.image}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 256px, 208px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .sympathy-ribbon { overflow: hidden; }
        .sympathy-ribbon__track {
          animation: sympathy-ribbon-scroll 60s linear infinite;
          will-change: transform;
        }
        .sympathy-ribbon:hover .sympathy-ribbon__track {
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
