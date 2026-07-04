type Props = { label: string; value: string; sub?: string };

export default function KpiCard({ label, value, sub }: Props) {
  return (
    <div className="rounded border border-ink/10 bg-bone p-3">
      <div className="text-xs uppercase tracking-wide text-ink/50">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink/50">{sub}</div>}
    </div>
  );
}
