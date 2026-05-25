"use client";
import DashboardShell from "./DashboardShell";

export default function LedgerView({ locale }: { locale: string }) {
  return (
    <DashboardShell locale={locale}>
      <p className="text-sm text-ink/60">Libro de órdenes — implementando…</p>
    </DashboardShell>
  );
}
