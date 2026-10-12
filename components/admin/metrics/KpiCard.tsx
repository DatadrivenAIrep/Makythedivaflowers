import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Delta } from "@/lib/metrics/period";

type Props = { label: string; value: string; delta?: Delta; sub?: string; href?: string };

function DeltaBadge({ delta }: { delta: Delta }) {
  const t = useTranslations("admin_metrics");
  if (delta.kind === "none") return null;
  if (delta.kind === "new") return <span className="text-xs font-semibold text-success">{t("delta_new")}</span>;
  if (delta.pct === 0) return <span className="text-xs text-ink/50">= 0%</span>;
  const up = delta.pct > 0;
  return <span className={`text-xs font-semibold ${up ? "text-success" : "text-error"}`}>{up ? "▲" : "▼"} {Math.abs(delta.pct)}%</span>;
}

export default function KpiCard({ label, value, delta, sub, href }: Props) {
  const t = useTranslations("admin_metrics");
  const body = (
    <>
      <div className="text-xs text-ink/60">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
        {delta && <DeltaBadge delta={delta} />}
        {delta?.kind === "pct" && <span className="text-xs text-ink/50">{t("delta_vs_prev")}</span>}
        {sub && <span className="text-xs text-ink/50">{sub}</span>}
      </div>
    </>
  );
  const cls = "block rounded-2xl bg-bone p-3.5";
  if (href) {
    return (
      <Link href={href} className={`${cls} transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rouge`}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
