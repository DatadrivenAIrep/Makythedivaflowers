"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowsClockwise, Plus, GearSix } from "@phosphor-icons/react/dist/ssr";

type Props = {
  locale: string;
  children: React.ReactNode;
  lastUpdated?: string;
  onRefresh?: () => void;
};

export default function DashboardShell({ locale, children, lastUpdated, onRefresh }: Props) {
  const pathname = usePathname();
  const isLedger = pathname.endsWith("/ledger");
  const isRunSheet = pathname.endsWith("/run-sheet");
  const isSettings = pathname.endsWith("/settings");
  const isGiftCards = pathname.includes("/admin/gift-cards");
  const isBandeja = !isLedger && !isRunSheet && !isSettings && !isGiftCards;
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
            >Bandeja</Link>
            <Link
              href={`${base}/run-sheet`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isRunSheet ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >Entregas hoy</Link>
            <Link
              href={`${base}/ledger`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isLedger ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >Libro de órdenes</Link>
            <Link
              href={`/${locale}/admin/gift-cards`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isGiftCards ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              Gift Cards
            </Link>
            <Link
              href={`/${locale}/admin/intake`}
              className="flex min-h-11 items-center gap-1 rounded-lg px-3 hover:bg-ink/5"
            ><Plus size={16} weight="bold" /> Nueva orden</Link>
          </nav>
          <Link
              href={`/${locale}/admin/settings`}
              className={`flex min-h-11 items-center gap-1 rounded-lg px-3 ${isSettings ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            ><GearSix size={16} weight="bold" /></Link>
          <div className="ml-auto flex items-center gap-3 text-xs text-ink/60">
            {lastUpdated && <span>Actualizado: {lastUpdated}</span>}
            {onRefresh && (
              <button onClick={onRefresh} className="flex min-h-11 items-center gap-1 rounded-lg border border-ink/20 px-3 hover:bg-ink/5">
                <ArrowsClockwise size={16} weight="bold" /> Actualizar
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
