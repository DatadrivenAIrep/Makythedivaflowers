import { getTranslations } from "next-intl/server";
import { ArchSVG } from "@/components/brand/ArchSVG";
import { Grain } from "@/components/brand/Grain";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { HeroReveal } from "@/components/home/HeroReveal";
import { PulseDot } from "@/components/home/PulseDot";
import { HeroMedia } from "@/components/home/HeroMedia";
import { heroSeason } from "@/lib/hero-season";
import type { Locale } from "@/types/locale";

export async function Hero({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.hero");
  const season = heroSeason();
  const copy = await getTranslations(season.copyNamespace);
  const [heroLine1, heroLine2] = copy("title").split(/, (.+)/);
  // With the subject on the right, the desktop button sits under the copy where
  // the eye already is, instead of in the bottom bar (the cookie notice covers it).
  // Phones always get it under the copy: there the notice spans the whole bottom.
  const inlineCta = season.subject === "right";

  return (
    <section className="relative min-h-[calc(100dvh-var(--nav-offset))] overflow-hidden">

      {/* 1. Background — looping video with gradient fallback */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(160deg, #1A1816 0%, #0E0D0C 55%, #2a0d1a 100%)",
        }}
      >
        <HeroMedia src={season.video} poster={season.poster} focus={season.focus} />
        {/* Legibility overlay — lighter overall, still anchored dark at the bottom for the CTAs */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-charcoal/20 via-charcoal/15 to-charcoal/65"
        />
        {/* Copy scrim — the subject fills the frame on phones and the right half on desktop */}
        {season.subject === "right" && (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-charcoal/45 to-charcoal/10 lg:bg-gradient-to-r lg:from-charcoal/80 lg:via-charcoal/40 lg:to-transparent"
          />
        )}
        {/* Brand accent — radial rouge wash from top-right */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              `radial-gradient(ellipse 60% 50% at 85% 10%, ${season.accent} 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* Grain — hero-scoped, subtler than the old page-level overlay */}
      <Grain className="absolute z-[5] opacity-[0.03]" />

      {/* 2. Eyebrow pill — top-left */}
      <div className="absolute top-20 left-4 lg:top-28 lg:left-8 z-20">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/90 border border-bone/30 bg-charcoal/40 backdrop-blur-sm px-3 py-1.5 rounded-full inline-block">
          {season.key === "default" ? "Long Island, New York · Since 2014" : copy("eyebrow")}
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
      <div
        className={`relative z-20 min-h-[calc(100dvh-var(--nav-offset))] flex flex-col px-6 ${
          season.subject === "right"
            ? "justify-end pb-28 lg:justify-center lg:pt-36 lg:pb-24 lg:pl-16 lg:pr-[50%]"
            : "justify-center lg:pl-[30%] lg:pr-16"
        }`}
      >
        <HeroReveal>
          <div className="pb-2">
            <h1
              className="font-display text-[clamp(4rem,10vw,10rem)] leading-[0.88] text-bone"
              style={{
                letterSpacing: "var(--text-display-tracking)",
                fontOpticalSizing: "auto",
              }}
            >
              <span style={{ fontStyle: "italic", fontVariationSettings: "'WONK' 0.4, 'SOFT' 0" }}>
                {heroLine1},
              </span>
              <br />
              <span style={{ fontVariationSettings: "'WONK' 0, 'SOFT' 0" }}>{heroLine2}</span>
            </h1>
          </div>
          <div>
            <p
              className="font-sans text-bone/90 text-base max-w-[46ch] leading-relaxed mt-6"
              style={{ textShadow: "0 1px 12px rgba(14,13,12,0.6)" }}
            >
              {copy("sub")}
            </p>
          </div>
          <div className={inlineCta ? "mt-8 lg:mt-10" : "mt-8 lg:hidden"}>
            <MagneticButton
              href={`/${locale}${season.ctaPath}`}
              ariaLabel={copy("cta_primary")}
            >
              {copy("cta_primary")}
            </MagneticButton>
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
      <div className="absolute bottom-0 left-0 right-0 z-20 [background:var(--material-bg-dark)] [backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] [-webkit-backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] [box-shadow:inset_0_1px_0_var(--material-edge-dark)]">
        <div className="hidden lg:grid grid-cols-3 items-center py-5 px-8 gap-6">
          <div className="flex items-center">
            {!inlineCta && (
              <MagneticButton
                href={`/${locale}${season.ctaPath}`}
                ariaLabel={copy("cta_primary")}
              >
                {copy("cta_primary")}
              </MagneticButton>
            )}
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

        {/* Mobile bottom bar — the main button lives under the copy on phones */}
        <div className="flex lg:hidden flex-col items-start gap-3 py-5 px-6">
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
