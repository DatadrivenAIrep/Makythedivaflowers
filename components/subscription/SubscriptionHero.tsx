import { getTranslations } from "next-intl/server";
import Image from "next/image";
import type { Locale } from "@/types/locale";

export async function SubscriptionHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "subscriptions" });
  return (
    <section className="relative isolate min-h-[72dvh] overflow-hidden md:min-h-[80dvh] flex flex-col justify-end">
      {/* Hero photograph */}
      <Image
        src="/subscriptions/hero-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[78%_center] md:object-[68%_center]"
      />

      {/* Horizontal wash so text on the left reads cleanly */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-ink via-ink/65 to-ink/5"
      />

      {/* Soft rouge accent — brand warmth without dominating */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 45% 50% at 88% 8%, rgba(184,52,94,0.18) 0%, transparent 65%)",
        }}
      />

      {/* Eyebrow pill */}
      <div className="absolute top-20 left-4 md:top-24 md:left-8 lg:left-14 z-20">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/85 border border-bone/30 bg-ink/40 backdrop-blur-md px-3 py-1.5 rounded-full inline-block">
          {t("eyebrow")}
        </span>
      </div>

      {/* Main content — anchored bottom-left */}
      <div className="relative z-20 px-6 md:px-10 lg:px-16 pb-16 md:pb-24 pt-40">
        <h1 className="font-display text-[clamp(3.5rem,9vw,8.5rem)] tracking-tighter leading-[0.9] text-bone max-w-[18ch] [text-shadow:0_2px_12px_rgba(14,13,12,0.6)]">
          {t("hero.title")}
        </h1>
        <p className="mt-5 max-w-[52ch] text-bone/80 text-base leading-relaxed [text-shadow:0_1px_6px_rgba(14,13,12,0.55)]">
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
