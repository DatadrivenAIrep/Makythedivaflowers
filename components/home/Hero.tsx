import { getTranslations } from "next-intl/server";
import { ArchSVG } from "@/components/brand/ArchSVG";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { HeroReveal } from "@/components/home/HeroReveal";
import { PulseDot } from "@/components/home/PulseDot";
import type { Locale } from "@/types/locale";

export async function Hero({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.hero");
  const [heroLine1, heroLine2] = t("title").split(/, (.+)/);

  return (
    <section className="relative min-h-[100dvh] overflow-hidden">

      {/* 1. Background — looping video with gradient fallback */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(160deg, #1A1816 0%, #0E0D0C 55%, #2a0d1a 100%)",
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero/divavideo-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/hero/divavideo.mp4" type="video/mp4" />
        </video>
        {/* Legibility overlay — darker at bottom where CTAs live */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-charcoal/40 via-charcoal/30 to-charcoal/75"
        />
        {/* Brand accent — radial rouge wash from top-right */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 85% 10%, rgba(184,52,94,0.22) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* 2. Eyebrow pill — top-left */}
      <div className="absolute top-20 left-4 lg:top-28 lg:left-8 z-20">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/90 border border-bone/30 bg-charcoal/40 backdrop-blur-sm px-3 py-1.5 rounded-full inline-block">
          Long Island, New York · Since 2014
        </span>
      </div>

      {/* 5. Arch ghost watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[8%] bottom-0 h-[90dvh] z-10 text-rouge opacity-20"
      >
        <ArchSVG className="h-full w-auto" strokeWidth={0.8} />
      </div>

      {/* Pulse dot — perpetual motion client component */}
      <PulseDot />

      {/* 3. Center hero text block */}
      <div className="relative z-20 min-h-[100dvh] flex flex-col justify-center px-6 lg:pl-[30%] lg:pr-16">
        <HeroReveal>
          <div className="pb-2">
            <h1
              className="font-display text-[clamp(4rem,10vw,10rem)] tracking-tighter leading-[0.88] text-bone"
              style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 0, 'opsz' 144" }}
            >
              <span style={{ fontStyle: "italic" }}>
                {heroLine1},
              </span>
              <br />
              <span>{heroLine2}</span>
            </h1>
          </div>
          <div>
            <p
              className="font-sans text-bone/90 text-base max-w-[46ch] leading-relaxed mt-6"
              style={{ textShadow: "0 1px 12px rgba(14,13,12,0.6)" }}
            >
              {t("sub")}
            </p>
          </div>
        </HeroReveal>
      </div>

      {/* 6. Scroll indicator */}
      <div
        aria-hidden
        className="hidden lg:flex absolute bottom-24 right-8 z-20 flex-col items-center gap-3"
      >
        <span
          className="font-mono text-[9px] tracking-[0.3em] text-petal/30 uppercase"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          SCROLL
        </span>
        <span className="block w-px h-10 bg-petal/20" />
      </div>

      {/* 4. Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-petal/10 backdrop-blur-md bg-charcoal/30">
        <div className="hidden lg:grid grid-cols-3 items-center py-5 px-8 gap-6">
          <div className="flex items-center">
            <MagneticButton
              href={`/${locale}/shop/arrangements`}
              ariaLabel={t("cta_primary")}
            >
              {t("cta_primary")}
            </MagneticButton>
          </div>
          <div className="flex items-center justify-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-petal/50 border border-petal/15 px-3 py-1.5 rounded-full">
              Same-day delivery · Nassau &amp; Queens
            </span>
          </div>
          <div className="flex items-center justify-end">
            <a
              href={`/${locale}/weddings`}
              className="font-sans text-sm tracking-tight text-bone/60 hover:text-bone/90 transition-colors duration-300 underline-offset-4 hover:underline"
            >
              {t("cta_secondary")} →
            </a>
          </div>
        </div>

        {/* Mobile bottom bar */}
        <div className="flex lg:hidden flex-col items-start gap-3 py-5 px-6">
          <MagneticButton
            href={`/${locale}/shop/arrangements`}
            ariaLabel={t("cta_primary")}
          >
            {t("cta_primary")}
          </MagneticButton>
          <a
            href={`/${locale}/weddings`}
            className="font-sans text-sm tracking-tight text-bone/60 hover:text-bone/90 transition-colors duration-300 underline-offset-4 hover:underline"
          >
            {t("cta_secondary")} →
          </a>
        </div>
      </div>
    </section>
  );
}
