import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function NavLinks({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");
  const links: { href: string; label: string }[] = [
    { href: `/${locale}/shop`, label: t("shop") },
    { href: `/${locale}/shop/subscriptions`, label: t("subscriptions") },
    { href: `/${locale}/weddings`, label: t("weddings") },
    { href: `/${locale}/events`, label: t("events") },
    { href: `/${locale}/story`, label: t("story") },
  ];
  return (
    <ul className="hidden md:flex items-center gap-7">
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
