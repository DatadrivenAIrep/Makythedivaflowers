"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, WhatsappLogo, Phone, X } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/format-datetime";
import type { CustomerProfileData } from "@/lib/customer-profile";
import type { Address } from "@/types/address";
import type { Order } from "@/types/order";
import OrderDetailDrawer from "@/components/admin/dashboard/OrderDetailDrawer";
import SegmentBadge from "./SegmentBadge";
import ImportantDates from "./ImportantDates";
import PreferenceChips from "./PreferenceChips";
import type { PreferencesMap } from "@/lib/customer-dates-storage";

type Props = { locale: string; initial: CustomerProfileData; suggestions: PreferencesMap };

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }
function addressText(a: Address): string {
  return `${a.street1}${a.street2 ? `, ${a.street2}` : ""}, ${a.city}, ${a.state} ${a.zip}`;
}
function itemCount(o: Order): number {
  return o.lines.reduce((n, l) => n + l.qty, 0);
}

export default function CustomerProfile({ locale, initial, suggestions }: Props) {
  const t = useTranslations("admin_customers");
  const [data, setData] = useState<CustomerProfileData>(initial);
  const [notesDraft, setNotesDraft] = useState(initial.customer.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const { customer, metrics, tags, orders } = data;
  const digits = customer.phone.replace(/\D/g, "");

  async function refresh() {
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as CustomerProfileData;
      setData(next);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { customer: CustomerProfileData["customer"] };
      setData((d) => ({ ...d, customer: body.customer }));
      setNotesSaved(true);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setSavingNotes(false);
    }
  }

  async function mutateTag(method: "POST" | "DELETE", tag: string) {
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/tags`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { tags: string[] };
      setData((d) => ({ ...d, tags: body.tags }));
      setError(false);
    } catch {
      setError(true);
    }
  }

  const metricCards: Array<{ key: string; value: string }> = [
    { key: "metric_ltv", value: money(metrics.ltvCents) },
    { key: "metric_aov", value: money(metrics.aovCents) },
    { key: "metric_orders", value: String(metrics.orderCount) },
    {
      key: "metric_first_order",
      value: metrics.firstOrderAt ? formatDate(metrics.firstOrderAt, locale) : t("never"),
    },
    {
      key: "metric_last_order",
      value: metrics.lastOrderAt
        ? metrics.daysSinceLastOrder !== null
          ? `${formatDate(metrics.lastOrderAt, locale)} · ${t("days_ago", { days: metrics.daysSinceLastOrder })}`
          : formatDate(metrics.lastOrderAt, locale)
        : t("never"),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        <Link href={`/${locale}/admin/customers`} className="text-sm text-ink/60 underline">
          ← {t("title")}
        </Link>
      </div>

      {error && (
        <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("error_load")}</div>
      )}

      <header className="mb-3 rounded border border-ink/10 bg-bone p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{customer.name}</h1>
          <SegmentBadge segment={metrics.segment} />
          {metrics.isVip && metrics.segment !== "vip" && <SegmentBadge segment="vip" />}
        </div>
        <div className="mt-2 text-sm text-ink/70">
          <span className="mr-2 text-xs uppercase tracking-wide text-ink/50">{t("profile_contact")}</span>
          <a href={`tel:${customer.phone}`} className="underline">{customer.phone}</a>
          {customer.email && (
            <> · <a href={`mailto:${customer.email}`} className="underline">{customer.email}</a></>
          )}
          {customer.messagingChannel && <> · {t("channel_label")}: {customer.messagingChannel}</>}
          {customer.locale && <> · {t("locale_label")}: {customer.locale.toUpperCase()}</>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-ink/50">{t("tags")}</span>
          {tags.map((tg) => (
            <span
              key={tg}
              className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/70"
            >
              {tg}
              <button
                type="button"
                aria-label={`${t("tags")}: ${tg} ×`}
                onClick={() => void mutateTag("DELETE", tg)}
                className="text-ink/40 hover:text-ink"
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tagDraft.trim()) {
                void mutateTag("POST", tagDraft);
                setTagDraft("");
              }
            }}
            className="flex items-center gap-1"
          >
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder={t("tag_placeholder")}
              className="h-8 rounded border border-ink/20 bg-bone px-2 text-xs"
            />
            <button
              type="submit"
              className="flex h-8 items-center gap-1 rounded border border-ink/20 px-2 text-xs hover:bg-ink/5"
            >
              <Plus size={12} weight="bold" /> {t("add_tag")}
            </button>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/${locale}/admin/intake?phone=${encodeURIComponent(customer.phone)}`}
            className="flex min-h-11 items-center gap-1 rounded-lg bg-rouge px-3 text-sm text-bone"
          >
            <Plus size={16} weight="bold" /> {t("new_order_cta")}
          </Link>
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-1 rounded-lg border border-ink/20 px-3 text-sm hover:bg-ink/5"
          >
            <WhatsappLogo size={16} weight="bold" /> {t("whatsapp")}
          </a>
          <a
            href={`tel:${customer.phone}`}
            className="flex min-h-11 items-center gap-1 rounded-lg border border-ink/20 px-3 text-sm hover:bg-ink/5"
          >
            <Phone size={16} weight="bold" /> {t("call")}
          </a>
        </div>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {metricCards.map((mc) => (
          <div key={mc.key} className="rounded border border-ink/10 bg-bone p-3">
            <div className="text-xs uppercase tracking-wide text-ink/50">{t(mc.key)}</div>
            <div className="text-sm font-semibold">{mc.value}</div>
          </div>
        ))}
      </div>

      <ImportantDates customerId={customer.id} initial={data.dates} locale={locale} />
      <PreferenceChips customerId={customer.id} initial={data.preferences} suggestions={suggestions} />

      <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
        <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("addresses")}</div>
        <div>
          <span className="text-ink/50">{t("buyer_address")}: </span>
          {customer.buyerAddress ? addressText(customer.buyerAddress) : t("no_address")}
        </div>
        <div>
          <span className="text-ink/50">{t("delivery_address")}: </span>
          {customer.lastAddress ? (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(addressText(customer.lastAddress))}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {addressText(customer.lastAddress)}
            </a>
          ) : (
            t("no_address")
          )}
        </div>
      </section>

      <section className="mb-3 rounded border border-ink/10 bg-bone p-3">
        <label htmlFor="crm-notes" className="mb-1 block text-xs uppercase tracking-wide text-ink/50">
          {t("notes")}
        </label>
        <textarea
          id="crm-notes"
          value={notesDraft}
          onChange={(e) => { setNotesDraft(e.target.value); setNotesSaved(false); }}
          placeholder={t("notes_placeholder")}
          rows={4}
          className="w-full rounded border border-ink/20 bg-bone p-2 text-sm"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={savingNotes}
            onClick={() => void saveNotes()}
            className="min-h-11 rounded-lg bg-rouge px-4 text-sm text-bone disabled:opacity-50"
          >
            {t("save_notes")}
          </button>
          {notesSaved && <span className="text-xs text-emerald-700">{t("notes_saved")}</span>}
        </div>
      </section>

      <section className="mb-3 rounded border border-ink/10 bg-bone p-3">
        <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("order_history")}</div>
        {orders.length === 0 ? (
          <div className="text-sm text-ink/50">{t("no_orders")}</div>
        ) : (
          <div className="flex flex-col gap-1">
            {orders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOpenOrderId(o.id)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded border border-ink/10 px-3 py-2 text-left text-sm hover:bg-ink/5"
              >
                <span className="font-semibold">#{o.orderNumber ?? o.id.slice(-6)}</span>
                <span className="text-ink/60">{formatDate(o.createdAt, locale)}</span>
                <span className="text-ink/60">{t("items_count", { count: itemCount(o) })}</span>
                <span
                  className={
                    o.paymentStatus === "paid"
                      ? "text-emerald-700"
                      : o.paymentStatus === "refunded"
                        ? "text-ink/50"
                        : "text-amber-700"
                  }
                >
                  {t(`pay_${o.paymentStatus}`)}
                </span>
                <span className="font-semibold">{money(o.totals.totalCents)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {openOrderId && (
        <OrderDetailDrawer
          orderId={openOrderId}
          onClose={() => setOpenOrderId(null)}
          onChanged={() => void refresh()}
        />
      )}
    </div>
  );
}
