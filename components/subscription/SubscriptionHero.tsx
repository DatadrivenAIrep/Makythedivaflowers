import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function SubscriptionHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "subscriptions" });
  return (
    <section className="relative min-h-[72dvh] md:min-h-[80dvh] overflow-hidden flex flex-col justify-end">
      {/* Charcoal base with rouge accent */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background: "linear-gradient(155deg, #1A1816 0%, #0E0D0C 50%, #2a0d1a 100%)",
        }}
      />
      {/* Rouge radial wash top-right */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 60% at 90% 5%, rgba(184,52,94,0.28) 0%, transparent 65%)",
        }}
      />

      {/* Eyebrow pill */}
      <div className="absolute top-20 left-4 md:top-24 md:left-8 lg:left-14 z-20">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/70 border border-bone/20 bg-charcoal/40 backdrop-blur-sm px-3 py-1.5 rounded-full inline-block">
          {t("eyebrow")}
        </span>
      </div>

      {/* Main content — anchored to bottom-left */}
      <div className="relative z-20 px-6 md:px-10 lg:px-16 pb-16 md:pb-24 pt-40">
        <h1
          className="font-display text-[clamp(3.5rem,9vw,8.5rem)] tracking-tighter leading-[0.9] text-bone max-w-[18ch]"
        >
          {t("hero.title")}
        </h1>
        <p className="mt-5 max-w-[52ch] text-bone/65 text-base leading-relaxed">
          {t("hero.body")}
        </p>
      </div>

      {/* Fade into bone background */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 h-28 z-10"
        style={{ background: "linear-gradient(to bottom, transparent, #FAF6F0)" }}
      />
    </section>
  );
}
