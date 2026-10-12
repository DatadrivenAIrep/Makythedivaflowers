import { useTranslations } from "next-intl";
import { SLOT_ORDER } from "@/lib/tv-slots";
import type { Heatmap } from "@/lib/metrics/operations";

// One hue, light → dark (sequential): more orders, darker rose.
const RAMP = ["#F7E6EC", "#EFC6D3", "#E09AB1", "#CB5F84", "#B8345E"];

export default function HeatmapGrid({ heatmap }: { heatmap: Heatmap }) {
  const t = useTranslations("admin_metrics");
  const max = Math.max(1, ...heatmap.counts.flat());
  const step = (v: number) => (v === 0 ? -1 : Math.min(RAMP.length - 1, Math.floor((v / max) * (RAMP.length - 1) + 1e-9)));
  return (
    <table className="w-full border-separate text-center text-xs" style={{ borderSpacing: 2 }}>
      <thead>
        <tr>
          <th />
          {heatmap.counts.map((_, d) => <th key={d} scope="col" className="font-normal text-ink/60">{t(`weekday_${d}`)}</th>)}
        </tr>
      </thead>
      <tbody>
        {SLOT_ORDER.map((slot, s) => (
          <tr key={slot}>
            <th scope="row" className="pr-2 text-left font-normal text-ink/60">{t(`slot_${slot}`)}</th>
            {heatmap.counts.map((row, d) => {
              const k = step(row[s]);
              return (
                <td key={d} className="h-9 rounded-md" style={{ background: k < 0 ? "#EDE8E0" : RAMP[k], color: k >= 3 ? "#FFFFFF" : "#0E0D0C" }}>
                  {row[s]}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
