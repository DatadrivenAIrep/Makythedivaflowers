// components/corsages/CorsagesCTA.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { CorsagesOpenModalButton } from "./CorsagesOpenModalButton";

export async function CorsagesCTA({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("corsages");
  return (
    <section className="bg-bone text-ink border-t border-ink/10">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24 text-center">
        <h2 className="font-display italic text-4xl md:text-6xl tracking-tighter leading-[0.95]">
          {t("cta_title")}
        </h2>
        <div className="mt-10 flex justify-center">
          <CorsagesOpenModalButton>
            {t("cta_button")}
          </CorsagesOpenModalButton>
        </div>
      </div>
    </section>
  );
}
