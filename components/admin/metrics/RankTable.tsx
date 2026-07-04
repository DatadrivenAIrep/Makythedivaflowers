export type RankRow = { key: string; name: string; value: string; sub?: string };

type Props = { nameHeader: string; valueHeader: string; rows: RankRow[]; emptyLabel: string };

export default function RankTable({ nameHeader, valueHeader, rows, emptyLabel }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded border border-ink/10 bg-bone p-4 text-center text-sm text-ink/50">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded border border-ink/10 bg-bone">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/50">
            <th className="px-3 py-2">{nameHeader}</th>
            <th className="px-3 py-2 text-right">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-ink/5 last:border-0">
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2 text-right">
                <span className="font-semibold">{r.value}</span>
                {r.sub && <span className="ml-2 text-ink/50">{r.sub}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
