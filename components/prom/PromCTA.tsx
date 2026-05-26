import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PromOpenModalButton } from "./PromOpenModalButton";

export async function PromCTA({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("prom.cta");
  return (
    <section className="bg-ink text-bone">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
          {t("eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-6xl tracking-tighter leading-[0.95]">
          {t("title")}
        </h2>
        <div className="mt-10 flex justify-center">
          <PromOpenModalButton
            variant="ghost"
            className="text-bone border-bone/40 hover:bg-bone/10 focus-visible:ring-bone/40"
          >
            {t("button")}
          </PromOpenModalButton>
        </div>
      </div>
    </section>
  );
}
