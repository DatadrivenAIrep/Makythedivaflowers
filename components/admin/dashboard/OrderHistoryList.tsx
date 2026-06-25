"use client";
import type { OrderChange } from "@/types/order";

function fmtTs(ts: string) { return new Date(ts).toLocaleString("es-US"); }

export default function OrderHistoryList({ history }: { history: OrderChange[] }) {
  if (history.length === 0) {
    return <div className="text-ink/50">Sin cambios todavía.</div>;
  }
  const ordered = [...history].reverse(); // newest first
  return (
    <ul className="space-y-2">
      {ordered.map((c) => (
        <li key={c.id} className="text-xs">
          <div>
            <span className="text-ink/60">{fmtTs(c.at)}</span>{" · "}
            <span className="font-semibold">{c.actor}</span>{" · "}
            <span>{c.summary}</span>
          </div>
          {c.changes && c.changes.length > 0 && (
            <ul className="mt-1 ml-3 space-y-0.5 text-ink/70">
              {c.changes.map((d, i) => (
                <li key={i}>
                  {d.label}: <span className="line-through">{d.before ?? "—"}</span> → <span className="font-medium">{d.after ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
