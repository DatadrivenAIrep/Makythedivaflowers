import { useTranslations } from "next-intl";
import type { DayLoad } from "@/lib/metrics/operations";

export default function UpcomingLoad({ days, locale }: { days: DayLoad[]; locale: string }) {
  const t = useTranslations("admin_metrics");
  const max = Math.max(1, ...days.map((d) => d.count));
  const busy = (c: number) => c > 0 && c >= max * 0.8;
  const label = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { weekday: "short", day: "numeric", timeZone: "UTC" });
  const peaks = days.filter((d) => busy(d.count));
  return (
    <div>
      <div className="flex h-24 items-end gap-1" role="img" aria-label={t("upcoming_title")}>
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end" title={`${label(d.date)} · ${t("upcoming_count", { count: d.count })}`}>
            <div className="w-full max-w-6 rounded-t" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 3 : 0, background: busy(d.count) ? "#B8345E" : "#DCD5C9" }} />
          </div>
        ))}
      </div>
      {days.length > 0 && (
        <div className="mt-1 flex justify-between text-[11px] text-ink/50">
          <span>{label(days[0].date)}</span>
          <span>{label(days[days.length - 1].date)}</span>
        </div>
      )}
      {peaks.length > 0 && (
        <p className="mt-1 text-xs text-ink/70">{peaks.map((d) => `${label(d.date)}: ${t("upcoming_count", { count: d.count })}`).join(" · ")}</p>
      )}
      <table className="sr-only" aria-label={t("upcoming_title")}>
        <tbody>{days.map((d) => <tr key={d.date}><td>{label(d.date)}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
