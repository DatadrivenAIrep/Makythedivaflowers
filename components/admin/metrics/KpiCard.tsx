import Link from "next/link";

type Props = { label: string; value: string; sub?: string; href?: string };

export default function KpiCard({ label, value, sub, href }: Props) {
  const body = (
    <>
      <div className="text-xs uppercase tracking-wide text-ink/50">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink/50">{sub}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block rounded border border-ink/10 bg-bone p-3 transition-colors hover:border-rouge/40 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rouge">
        {body}
      </Link>
    );
  }
  return <div className="rounded border border-ink/10 bg-bone p-3">{body}</div>;
}
