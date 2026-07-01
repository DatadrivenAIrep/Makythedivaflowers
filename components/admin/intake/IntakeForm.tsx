"use client";
import { useState, useEffect, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { Product } from "@/types/product";
import type { CartLine, OrderTotals } from "@/types/order";
import CustomerBlock, { type CustomerSnapshot } from "./CustomerBlock";
import FulfillmentBlock, { type FulfillmentState } from "./FulfillmentBlock";
import ProductPicker from "./ProductPicker";
import CartLines from "./CartLines";
import CartTotals from "./CartTotals";
import PaymentBlock, { type PaymentState } from "./PaymentBlock";
import { toOrderFulfillment } from "./FulfillmentBlock";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format-datetime";

type Channel = "walk-in" | "phone" | "whatsapp" | "event";

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-mute-200 bg-white p-5 mb-4">
      <h2 className="font-display text-lg text-ink mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function IntakeForm({ products }: { products: Product[] }) {
  const t = useTranslations("admin_intake");
  const locale = useLocale() as "en" | "es";
  const channels: { id: Channel; label: string }[] = [
    { id: "walk-in", label: t("channel_walk_in") },
    { id: "phone", label: t("channel_phone") },
    { id: "whatsapp", label: t("channel_whatsapp") },
    { id: "event", label: t("channel_event") },
  ];
  const [channel, setChannel] = useState<Channel>("walk-in");
  const [customer, setCustomer] = useState<CustomerSnapshot>({ name: "", phone: "", email: "", messagingChannel: "sms" });
  const [fulfillment, setFulfillment] = useState<FulfillmentState>({
    method: "delivery",
    recipient: { name: "", phone: "" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: new Date().toISOString().slice(0, 10), slot: "midday" },
    cardMessage: "",
  });
  const [lines, setLines] = useState<CartLine[]>([]);
  const [override, setOverride] = useState<Partial<OrderTotals>>({});
  const router = useRouter();
  const searchParams = useSearchParams();
  const okOrderId = searchParams.get("ok");
  const [banner, setBanner] = useState<{
    orderId: string;
    channel?: string;
    phone?: string;
    status?: string;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    if (!okOrderId) {
      setBanner(null);
      return;
    }
    setBanner({ orderId: okOrderId });
    fetch(`/api/admin/orders/${encodeURIComponent(okOrderId)}/last-message`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!m || !m.found) return;
        setBanner((b) =>
          b
            ? { ...b, channel: m.channel, phone: m.toPhone, status: m.status, reason: m.error }
            : null,
        );
      })
      .catch(() => {});
  }, [okOrderId]);

  async function retrySend() {
    if (!banner) return;
    await fetch(`/api/admin/orders/${encodeURIComponent(banner.orderId)}/payment-link`, {
      method: "POST",
    });
    // Re-trigger the banner fetch by replacing the URL with the same ok param.
    router.replace(`/${locale}/admin/intake?ok=${encodeURIComponent(banner.orderId)}&r=${Date.now()}`);
  }

  const [giftCardCode, setGiftCardCode] = useState("");
  const [payment, setPayment] = useState<PaymentState>({ status: "pending" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addLine(line: CartLine) {
    setLines((prev) => {
      if (line.kind === "catalog") {
        const idx = prev.findIndex(
          (l) => l.kind === "catalog" && l.productId === line.productId && l.variantId === line.variantId,
        );
        if (idx >= 0) {
          const next = [...prev];
          const cur = next[idx];
          next[idx] = { ...cur, qty: cur.qty + 1 } as CartLine;
          return next;
        }
      }
      return [...prev, line];
    });
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        source: channel,
        customer: {
          phone: customer.phone,
          name: customer.name,
          email: customer.email || undefined,
          messagingChannel: customer.messagingChannel,
          locale,
          buyerAddress: customer.buyerAddress,
        },
        fulfillment: toOrderFulfillment(fulfillment),
        lines,
        totalsOverride: override,
        giftCardCode: giftCardCode || undefined,
        payment,
      };
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(JSON.stringify(data.errors ?? data.error ?? "unknown"));
        return;
      }
      const { orderId } = await res.json();
      router.replace(`/${locale}/admin/intake?ok=${encodeURIComponent(orderId)}`);
      setCustomer({ name: "", phone: "", email: "", messagingChannel: "sms", buyerAddress: undefined });
      setLines([]);
      setOverride({});
      setGiftCardCode("");
      setPayment({ status: "pending" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-[1180px] mx-auto p-6">
      <p className="text-mute-500 text-sm mb-2">{t("page_subtitle")}</p>
      <h1 className="font-display text-3xl text-ink mb-6">{t("title_new")}</h1>

      {banner && (
        <div className="mb-4 px-5 py-3 rounded-2xl bg-bone border border-mute-200 flex items-center justify-between gap-3 text-sm">
          <div>
            <span className="font-medium">{t("banner_saved", { orderId: banner.orderId })}</span>
            {banner.channel && banner.status === "sent" && (
              <span className="text-mute-600">
                {" · "}
                {t("banner_message_sent", {
                  channel: banner.channel.toUpperCase(),
                  phone: banner.phone ?? "",
                })}
              </span>
            )}
            {banner.status === "skipped" && (
              <span className="text-mute-600">
                {" · "}
                {t("banner_message_skipped", {
                  channel: (banner.channel ?? "").toUpperCase(),
                  reason: banner.reason ?? "",
                })}
              </span>
            )}
            {banner.status === "failed" && (
              <span className="text-error">
                {" · "}
                {t("banner_message_failed", {
                  channel: (banner.channel ?? "").toUpperCase(),
                  phone: banner.phone ?? "",
                })}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {banner.status === "failed" && (
              <button
                type="button"
                onClick={retrySend}
                className="px-3 py-1.5 rounded-full bg-ink text-bone text-xs"
              >
                {t("banner_retry")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="px-3 py-1.5 rounded-full border border-mute-200 text-mute-600 text-xs"
            >
              {t("banner_dismiss")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-bento shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-7 py-5 border-b border-mute-100">
          <div className="flex gap-1.5">
            {channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannel(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-sm transition ${
                  channel === c.id
                    ? "bg-ink text-bone"
                    : "bg-mute-100 text-mute-600 hover:bg-mute-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="text-mute-400 text-xs tabular-nums" suppressHydrationWarning>
            {formatDateTime(new Date().toISOString(), locale)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5 bg-bone">
          <div>
            <SectionCard title={t("section_customer")}>
              <CustomerBlock
                value={customer}
                onChange={setCustomer}
                onApplyAddress={(addr) => setFulfillment((f) => ({ ...f, address: addr, method: "delivery" }))}
              />
            </SectionCard>
            <SectionCard title={t("section_fulfillment")}>
              <FulfillmentBlock value={fulfillment} onChange={setFulfillment} />
            </SectionCard>
          </div>
          <div>
            <SectionCard title={t("section_products")}>
              <ProductPicker products={products} onAdd={addLine} />
              <div className="mt-4"><CartLines lines={lines} onChangeLines={setLines} /></div>
            </SectionCard>
            <SectionCard title={t("section_payment")}>
              <CartTotals
                lines={lines}
                fulfillmentMethod={fulfillment.method}
                deliveryZip={fulfillment.address.zip}
                deliveryCity={fulfillment.address.city}
                override={override}
                onOverride={setOverride}
              />
              <div className="mt-4"><PaymentBlock value={payment} onChange={setPayment} /></div>
              <label className="block mt-4">
                <span className="mb-1 block text-xs font-semibold">{t("gift_card_label")}</span>
                <input value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value)} placeholder="DIVA-XXXX-XXXX" className="w-full rounded-lg border border-ink/20 px-3 py-2 font-mono" />
              </label>
            </SectionCard>
          </div>
        </div>

        <div className="px-7 py-4 border-t border-mute-100 bg-white">
          <div className="flex items-center justify-between">
            <button type="button" className="px-5 py-3 rounded-full border border-mute-200 text-mute-600">
              {t("action_discard")}
            </button>
            <button
              type="button"
              disabled={submitting || lines.length === 0 || (fulfillment.method !== "pickup" && (customer.name.length === 0 || customer.phone.replace(/\D/g, "").length < 10))}
              onClick={onSubmit}
              className="px-7 py-3.5 rounded-full bg-ink text-bone font-display disabled:opacity-40"
            >
              {submitting ? t("action_saving") : t("action_save")}
            </button>
          </div>
          {error && <p className="text-error text-sm mt-2 break-all">{error}</p>}
        </div>
      </div>
    </main>
  );
}
