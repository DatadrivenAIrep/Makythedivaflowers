"use client";
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
  const isCustomers = pathname.includes("/admin/customers");
  const isOccasions = pathname.includes("/admin/occasions");
  const isMetrics = pathname.includes("/admin/metrics");
  const isBandeja =
    !isLedger && !isRunSheet && !isSettings && !isGiftCards && !isCustomers && !isOccasions && !isMetrics;
  const base = `/${locale}/admin/dashboard`;

  return (
    <div className="flex min-h-screen flex-col bg-mute-100">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-bone/95 backdrop-blur">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link href={base} className="flex items-center" aria-label="Diva Admin">
            <Image src="/logo-header.webp" alt="Maky the Diva Flowers" width={320} height={96} priority className="h-9 w-auto" />
          </Link>
          <nav className="ml-2 flex gap-1 text-sm">
            <Link
              href={base}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isBandeja ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >{t("nav_bandeja")}</Link>
            <Link
              href={`${base}/run-sheet`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isRunSheet ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >{t("nav_run_sheet")}</Link>
            <Link
              href={`${base}/ledger`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isLedger ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >{t("nav_ledger")}</Link>
            <Link
              href={`/${locale}/admin/gift-cards`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isGiftCards ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_gift_cards")}
            </Link>
            <Link
              href={`/${locale}/admin/customers`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isCustomers ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_customers")}
            </Link>
            <Link
              href={`/${locale}/admin/occasions`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isOccasions ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_occasions")}
            </Link>
            <Link
              href={`/${locale}/admin/metrics`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isMetrics ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_metrics")}
            </Link>
            <Link
              href={`/${locale}/admin/intake`}
              className="flex min-h-11 items-center gap-1 rounded-lg px-3 hover:bg-ink/5"
            ><Plus size={16} weight="bold" /> {t("nav_new_order")}</Link>
          </nav>
          <Link
              href={`/${locale}/admin/settings`}
              className={`flex min-h-11 items-center gap-1 rounded-lg px-3 ${isSettings ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            ><GearSix size={16} weight="bold" /></Link>
          <div className="ml-auto flex items-center gap-3 text-xs text-ink/60">
            <LocaleSwitcher current={locale as Locale} />
            {lastUpdated && <span>{t("last_updated")}: {lastUpdated}</span>}
            {onRefresh && (
              <button onClick={onRefresh} className="flex min-h-11 items-center gap-1 rounded-lg border border-ink/20 px-3 hover:bg-ink/5">
                <ArrowsClockwise size={16} weight="bold" /> {t("refresh")}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
