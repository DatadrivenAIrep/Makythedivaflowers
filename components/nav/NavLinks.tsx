import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { MegaMenu } from "./MegaMenu";

export async function NavLinks({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");
  const links: { href: string; label: string }[] = [
    { href: `/${locale}/sympathy`, label: t("sympathy") },
    { href: `/${locale}/subscriptions`, label: t("subscriptions") },
    { href: `/${locale}/weddings`, label: t("weddings") },
    { href: `/${locale}/events`, label: t("events") },
    { href: `/${locale}/story`, label: t("story") },
  ];
  return (
    <ul className="hidden md:flex items-center gap-7">
      <li>
        <MegaMenu locale={locale} label={t("shop")} />
      </li>
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="font-sans text-sm tracking-tight text-ink/80 hover:text-ink transition-colors"
          >
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
