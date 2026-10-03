"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowsClockwise, Plus, GearSix } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/nav/LocaleSwitcher";
import type { Locale } from "@/types/locale";

type Props = {
  locale: string;
  children: React.ReactNode;
  lastUpdated?: string;
  onRefresh?: () => void;
};

export default function DashboardShell({ locale, children, lastUpdated, onRefresh }: Props) {
  const pathname = usePathname();
  const t = useTranslations("admin_dashboard");
  const isLedger = pathname.endsWith("/ledger");
  const isRunSheet = pathname.endsWith("/run-sheet");
  const isSettings = pathname.endsWith("/settings");
  const isGiftCards = pathname.includes("/admin/gift-cards");
  const isPromos = pathname.includes("/admin/promos");
  const isCustomers = pathname.includes("/admin/customers");
  const isOccasions = pathname.includes("/admin/occasions");
  const isMetrics = pathname.includes("/admin/metrics");
  const isPipeline = pathname.includes("/admin/pipeline");
  const isCampaigns = pathname.includes("/admin/campaigns");
  const isMessages = pathname.includes("/admin/messages");
  const isAccounts = pathname.includes("/admin/accounts");
  const isBandeja =
    !isLedger && !isRunSheet && !isSettings && !isGiftCards && !isPromos && !isCustomers && !isAccounts && !isOccasions && !isMetrics && !isPipeline && !isCampaigns && !isMessages;
  const base = `/${locale}/admin/dashboard`;
  const navRef = useRef<HTMLElement>(null);

  // The tab row scrolls sideways on phones and small laptops: keep the current section in view.
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>("[aria-current=page]");
    if (!nav || !current) return;
    nav.scrollLeft = current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-mute-100">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-bone/95 backdrop-blur">
        {/* Row 1: brand + global actions. They never scroll away, so "new order" is always one tap. */}
        <div className="flex items-center gap-2 px-4 pt-2 sm:gap-3">
          <Link href={base} className="flex shrink-0 items-center" aria-label="Diva Admin">
            <Image src="/logo-header.webp" alt="Maky the Diva Flowers" width={320} height={96} priority className="h-9 w-auto" />
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-xs text-ink/60 sm:gap-3">
            {lastUpdated && <span className="hidden md:inline">{t("last_updated")}: {lastUpdated}</span>}
            {onRefresh && (
              <button onClick={onRefresh} aria-label={t("refresh")} className="flex min-h-11 shrink-0 items-center whitespace-nowrap gap-1 rounded-lg border border-ink/20 px-3 hover:bg-ink/5">
                <ArrowsClockwise size={16} weight="bold" /> <span className="hidden sm:inline">{t("refresh")}</span>
              </button>
            )}
            <LocaleSwitcher current={locale as Locale} />
            <Link
              href={`/${locale}/admin/settings`}
              aria-label={t("nav_settings")}
              aria-current={isSettings ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap gap-1 rounded-lg px-3 text-sm text-ink ${isSettings ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            ><GearSix size={16} weight="bold" /></Link>
            <Link
              href={`/${locale}/admin/intake`}
              aria-label={t("nav_new_order")}
              className="flex min-h-11 shrink-0 items-center whitespace-nowrap gap-1 rounded-lg border border-rouge/40 px-3 text-sm font-medium text-rouge hover:bg-rouge/5"
            ><Plus size={16} weight="bold" /> <span className={onRefresh ? "hidden sm:inline" : "hidden min-[390px]:inline"}>{t("nav_new_order")}</span></Link>
          </div>
        </div>
        {/* Row 2: section tabs, always one line. The right edge fades when there is more to scroll to. */}
        <nav
          ref={navRef}
          className="relative flex gap-1 overflow-x-auto px-4 pb-2 pt-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]"
        >
            <Link
              href={base}
              aria-current={isBandeja ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isBandeja ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >{t("nav_bandeja")}</Link>
            <Link
              href={`${base}/run-sheet`}
              aria-current={isRunSheet ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isRunSheet ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >{t("nav_run_sheet")}</Link>
            <Link
              href={`${base}/ledger`}
              aria-current={isLedger ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isLedger ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >{t("nav_ledger")}</Link>
            <Link
              href={`/${locale}/admin/gift-cards`}
              aria-current={isGiftCards ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isGiftCards ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_gift_cards")}
            </Link>
            <Link
              href={`/${locale}/admin/promos`}
              aria-current={isPromos ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isPromos ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_promos")}
            </Link>
            <Link
              href={`/${locale}/admin/customers`}
              aria-current={isCustomers ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isCustomers ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_customers")}
            </Link>
            <Link
              href={`/${locale}/admin/accounts`}
              aria-current={isAccounts ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isAccounts ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_accounts")}
            </Link>
            <Link
              href={`/${locale}/admin/occasions`}
              aria-current={isOccasions ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isOccasions ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_occasions")}
            </Link>
            <Link
              href={`/${locale}/admin/metrics`}
              aria-current={isMetrics ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isMetrics ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_metrics")}
            </Link>
            <Link
              href={`/${locale}/admin/pipeline`}
              aria-current={isPipeline ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isPipeline ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_pipeline")}
            </Link>
            <Link
              href={`/${locale}/admin/messages`}
              aria-current={isMessages ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isMessages ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_messages")}
            </Link>
            <Link
              href={`/${locale}/admin/campaigns`}
              aria-current={isCampaigns ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 ${isCampaigns ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_campaigns")}
            </Link>
            <span aria-hidden className="w-6 shrink-0" />
        </nav>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
