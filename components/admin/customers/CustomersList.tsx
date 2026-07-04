"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/format-datetime";
import type {
  CustomerListResult,
  CustomerSegmentFilter,
  CustomerSort,
} from "@/lib/customer-storage";
import SegmentBadge from "./SegmentBadge";

type Props = { locale: string; initial: CustomerListResult; allTags: string[] };

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

const SEGMENTS: Array<{ id: CustomerSegmentFilter | "all"; key: string }> = [
  { id: "all", key: "seg_all" },
  { id: "new", key: "seg_new" },
  { id: "recurring", key: "seg_recurring" },
  { id: "vip", key: "seg_vip" },
  { id: "at_risk", key: "seg_at_risk" },
];

const SORTS: Array<{ id: CustomerSort; key: string }> = [
  { id: "last_order", key: "sort_last_order" },
  { id: "ltv", key: "sort_ltv" },
  { id: "orders", key: "sort_orders" },
  { id: "name", key: "sort_name" },
];

export default function CustomersList({ locale, initial, allTags }: Props) {
  const t = useTranslations("admin_customers");
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<CustomerSegmentFilter | "all">("all");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<CustomerSort>("last_order");
  const [data, setData] = useState<CustomerListResult>(initial);
  const [error, setError] = useState(false);
  const firstRender = useRef(true);

  function query(cursor?: string | null): string {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (segment !== "all") sp.set("segment", segment);
    if (tag) sp.set("tag", tag);
    if (sort !== "last_order") sp.set("sort", sort);
    if (cursor) sp.set("cursor", cursor);
    return sp.toString();
  }

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/admin/customers?${query()}`, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          setData((await res.json()) as CustomerListResult);
          setError(false);
        } catch {
          setError(true);
        }
      })();
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, segment, tag, sort]);

  async function loadMore() {
    if (!data.nextCursor) return;
    try {
      const res = await fetch(`/api/admin/customers?${query(data.nextCursor)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as CustomerListResult;
      setData({ ...next, customers: [...data.customers, ...next.customers] });
    } catch {
      setError(true);
    }
  }

  const s = data.stats;
  const stats: Array<{ key: string; value: string }> = [
    { key: "stat_total", value: String(s.total) },
    { key: "stat_new_month", value: String(s.newThisMonth) },
    { key: "stat_repeat_rate", value: `${s.repeatRatePct}%` },
    { key: "stat_at_risk", value: String(s.atRiskCount) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((st) => (
          <div key={st.key} className="rounded border border-ink/10 bg-bone p-3">
            <div className="text-xs uppercase tracking-wide text-ink/50">{t(st.key)}</div>
            <div className="text-xl font-semibold">{st.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search_placeholder")}
          className="min-h-11 w-full max-w-xs rounded-lg border border-ink/20 bg-bone px-3 text-sm"
        />
        <div className="flex gap-1">
          {SEGMENTS.map((sg) => (
            <button
              key={sg.id}
              type="button"
              onClick={() => setSegment(sg.id)}
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${
                segment === sg.id ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"
              }`}
            >
              {t(sg.key)}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="min-h-11 rounded-lg border border-ink/20 bg-bone px-2 text-sm"
          >
            <option value="">{t("tag_filter_all")}</option>
            {allTags.map((tg) => (
              <option key={tg} value={tg}>{tg}</option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as CustomerSort)}
          aria-label={t("sort_label")}
          className="ml-auto min-h-11 rounded-lg border border-ink/20 bg-bone px-2 text-sm"
        >
          {SORTS.map((so) => (
            <option key={so.id} value={so.id}>{t(so.key)}</option>
          ))}
        </select>
      </div>

      {error && <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("error_load")}</div>}

      {data.customers.length === 0 ? (
        <div className="rounded border border-ink/10 bg-bone p-6 text-center text-sm text-ink/50">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-ink/10 bg-bone">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-3 py-2">{t("col_customer")}</th>
                <th className="px-3 py-2">{t("col_phone")}</th>
                <th className="px-3 py-2 text-right">{t("col_orders")}</th>
                <th className="px-3 py-2 text-right">{t("col_ltv")}</th>
                <th className="px-3 py-2">{t("col_last_order")}</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((c) => (
                <tr key={c.id} className="border-b border-ink/5 last:border-0 hover:bg-ink/5">
                  <td className="px-3 py-2">
                    <Link
                      href={`/${locale}/admin/customers/${c.id}`}
                      className="flex flex-wrap items-center gap-2 font-semibold"
                    >
                      {c.name}
                      <SegmentBadge segment={c.metrics.segment} />
                      {c.tags.map((tg) => (
                        <span key={tg} className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
                          {tg}
                        </span>
                      ))}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-ink/70">{c.phone}</td>
                  <td className="px-3 py-2 text-right">{c.metrics.orderCount}</td>
                  <td className="px-3 py-2 text-right font-semibold">{money(c.metrics.ltvCents)}</td>
                  <td className="px-3 py-2 text-ink/70">
                    {c.metrics.lastOrderAt ? formatDate(c.metrics.lastOrderAt, locale) : t("never")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.nextCursor && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={loadMore}
            className="min-h-11 rounded-lg border border-ink/20 px-4 text-sm hover:bg-ink/5"
          >
            {t("load_more")}
          </button>
        </div>
      )}
    </div>
  );
}
