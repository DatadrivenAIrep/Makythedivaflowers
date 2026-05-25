"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  locale: string;
  children: React.ReactNode;
  lastUpdated?: string;
  onRefresh?: () => void;
};

export default function DashboardShell({ locale, children, lastUpdated, onRefresh }: Props) {
  const pathname = usePathname();
  const isLedger = pathname.endsWith("/ledger");
  const base = `/${locale}/admin/dashboard`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-bone/95 backdrop-blur">
        <div className="flex items-center gap-4 px-4 py-3">
          <span className="text-sm font-semibold tracking-wide">Diva · Admin</span>
          <nav className="ml-2 flex gap-1 text-sm">
            <Link
              href={base}
              className={`rounded px-3 py-1 ${!isLedger ? "bg-ink text-bone" : "hover:bg-ink/5"}`}
            >Bandeja</Link>
            <Link
              href={`${base}/ledger`}
              className={`rounded px-3 py-1 ${isLedger ? "bg-ink text-bone" : "hover:bg-ink/5"}`}
            >Libro de órdenes</Link>
            <Link
              href={`/${locale}/admin/intake`}
              className="rounded px-3 py-1 hover:bg-ink/5"
            >+ Nueva orden</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-ink/60">
            {lastUpdated && <span>Actualizado: {lastUpdated}</span>}
            {onRefresh && (
              <button onClick={onRefresh} className="rounded border border-ink/20 px-2 py-1 hover:bg-ink/5">
                ↻ Actualizar
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
