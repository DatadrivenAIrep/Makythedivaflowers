"use client";
import { useTranslations } from "next-intl";

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("nav");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("open_menu")}
      className="md:hidden flex flex-col justify-center gap-[7px] p-2 text-ink/80 hover:text-ink transition-colors"
    >
      <span className="block h-[1.5px] w-5 bg-current rounded-full" />
      <span className="block h-[1.5px] w-3.5 bg-current rounded-full" />
    </button>
  );
}
