"use client";
import { useTranslations } from "next-intl";

export function StickyMobileCTA() {
  const t = useTranslations("mothers_day");
  return (
    <a
      href="#md-edit"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-rouge px-6 py-3 text-sm font-semibold text-bone shadow-lg md:hidden"
    >
      {t("sticky_cta")}
    </a>
  );
}
