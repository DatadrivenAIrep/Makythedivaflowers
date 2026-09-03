// components/account/AccountShell.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

// No sign-up tab: sign-in is by SMS code and the account exists once you have
// ordered, so there is nothing to register for.
const TABS = [
  { key: "sign-in", href: (locale: Locale) => `/${locale}/account` },
  { key: "orders", href: (locale: Locale) => `/${locale}/account/orders` },
] as const;

type Props = {
  locale: Locale;
  activeTab: "sign-in" | "orders";
  children: React.ReactNode;
};

export async function AccountShell({ locale, activeTab, children }: Props) {
  const t = await getTranslations({ locale, namespace: "account" });
  return (
    <main className="pt-32 pb-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <header className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h1 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h1>
        </header>
        <nav className="flex gap-1 mb-10 border-b border-ink/10">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href(locale)}
              className={`px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-ink text-ink"
                  : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              {t(`tabs.${tab.key}`)}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}
