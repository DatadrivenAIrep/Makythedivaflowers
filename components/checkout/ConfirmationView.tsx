import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { PRODUCTS } from "@/data/products";
import { resolveCartLines } from "@/lib/cart-helpers";
import { ProductImage } from "@/components/product/ProductImage";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import type { Order } from "@/types/order";
import type { Locale } from "@/types/locale";

export async function ConfirmationView({ order, locale }: { order: Order; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "confirmation" });
  const resolved = resolveCartLines(order.lines, PRODUCTS);
  const hasSubscription = resolved.some((r) => r.product.category === "subscriptions");
  const windowLabel = formatDeliveryWindow(order.delivery.window, locale);

  return (
    <div className="space-y-12">
      <header className="flex flex-col items-start gap-4 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-success/10 text-success px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em]">
          <CheckCircle size={14} weight="fill" />
          {t("paid_label")}
        </span>
        <h1 className="font-display text-5xl sm:text-6xl text-ink leading-[0.95] tracking-tighter">
          {t("title", { name: order.delivery.recipient.name })}
        </h1>
        <p className="text-base text-ink/75 max-w-[58ch]">
          {hasSubscription ? t("body_subscription", { date: order.delivery.window.date }) : t("body")}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          {t("order_id")}: <span className="text-ink">{order.id}</span>
        </p>
      </header>
      <section className="grid gap-12 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 mb-3">{t("delivery_to")}</p>
            <p className="font-display text-2xl text-ink">{order.delivery.recipient.name}</p>
            <p className="text-sm text-ink/75">
              {order.delivery.address.street1}{order.delivery.address.street2 && `, ${order.delivery.address.street2}`}
              <br />
              {order.delivery.address.city}, {order.delivery.address.state} {order.delivery.address.zip}
            </p>
            <p className="font-mono text-sm text-ink mt-2">{formatPhoneUS(order.delivery.recipient.phone)}</p>
            <p className="font-mono text-sm text-ink mt-2">{windowLabel}</p>
            {order.delivery.cardMessage && (
              <blockquote className="mt-4 border-l-2 border-rouge pl-4 text-ink/80 italic">
                "{order.delivery.cardMessage}"
              </blockquote>
            )}
          </div>
          <ul className="divide-y divide-ink/10">
            {resolved.map((r) => (
              <li key={`${r.line.productId}-${r.line.variantId}`} className="grid grid-cols-[80px_1fr_auto] gap-4 py-4 items-center">
                <div className="aspect-[4/5] overflow-hidden rounded-xl bg-bone">
                  <ProductImage image={r.product.images[0]} locale={locale} sizes="80px" />
                </div>
                <div>
                  <p className="font-display text-lg text-ink">{r.product.title[locale]}</p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/55 mt-0.5">
                    {r.variant.label[locale]} · ×{r.line.qty}
                  </p>
                </div>
                <span className="font-mono text-sm tabular-nums text-ink">{formatMoneyCents(r.lineTotalCents, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="lg:sticky lg:top-24 self-start space-y-3 rounded-2xl border border-ink/10 p-6 font-mono text-[12px]">
          <p className="font-display text-xl text-ink mb-3">{t("totals")}</p>
          <ConfRow label={t("subtotal")} value={formatMoneyCents(order.totals.subtotalCents, locale)} />
          <ConfRow label={t("delivery")} value={formatMoneyCents(order.totals.deliveryCents, locale)} />
          <ConfRow label={t("tax")} value={formatMoneyCents(order.totals.taxCents, locale)} />
          <div className="h-px bg-ink/10" />
          <ConfRow label={t("total")} value={formatMoneyCents(order.totals.totalCents, locale)} bold />
        </aside>
      </section>
      <footer className="pt-8">
        <Button asChild variant="primary">
          <Link href={`/${locale}/shop`}>
            {t("back_to_shop")}
          </Link>
        </Button>
      </footer>
    </div>
  );
}

function ConfRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="uppercase tracking-[0.18em] text-ink/60">{label}</dt>
      <dd className={`tabular-nums ${bold ? "text-ink text-base" : "text-ink/80"}`}>{value}</dd>
    </div>
  );
}
