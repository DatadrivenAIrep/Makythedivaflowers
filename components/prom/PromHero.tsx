import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PromOpenModalButton } from "./PromOpenModalButton";

export async function PromHero({ locale }: { locale: Locale }) {
  const t = await getTranslations("prom.hero");
  return (
    <header className="relative isolate overflow-hidden bg-petal text-ink">
      <div className="relative mx-auto max-w-[var(--container-max)] px-6 pt-24 pb-20 md:pt-32 md:pb-28">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-4 max-w-3xl font-display italic text-5xl leading-[0.95] tracking-tighter md:text-7xl"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("title")}
        </h1>
        <p className="mt-6 max-w-2xl font-sans text-base leading-relaxed text-ink/80 md:text-lg">
          {t("subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <PromOpenModalButton>{t("cta")}</PromOpenModalButton>
        </div>
      </div>
    </header>
  );
}
