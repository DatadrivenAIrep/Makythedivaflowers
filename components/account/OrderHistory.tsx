import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PRODUCTS } from "@/data/products";
import { resolveCartLines } from "@/lib/cart-helpers";
import { formatMoneyCents } from "@/lib/format";
import type { Order } from "@/types/order";
import type { Locale } from "@/types/locale";
import { SignOutButton } from "@/components/account/SignOutButton";

/**
 * The customer's own orders. Repeat gifting is most of a florist's revenue, so
 * the useful thing here is not a receipt — it is being able to send the same
 * thing again without remembering what it was called.
 */
export async function OrderHistory({ orders, locale }: { orders: Order[]; locale: Locale }) {
  const t = await getTranslations("account.history");
  const dateFmt = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl tracking-tight text-ink">{t("title")}</h2>
        <SignOutButton locale={locale} label={t("sign_out")} />
      </div>

      <ul className="space-y-4">
        {orders.map((order) => {
          const lines = resolveCartLines(order.lines, PRODUCTS);
          const first = lines[0];
          return (
            <li key={order.id}>
              {/* An <article>: each order is self-contained, and it keeps the
                  card distinguishable from the line items nested inside it. */}
              <article className="rounded-2xl border border-ink/10 bg-bone/60 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute-500">
                  {order.orderNumber ? `#${order.orderNumber} · ` : ""}
                  {dateFmt.format(new Date(order.createdAt))}
                </p>
                <p className="font-mono text-sm text-ink/85">
                  {formatMoneyCents(order.totals.totalCents, locale)}
                </p>
              </div>

              <ul className="mt-3 space-y-1">
                {lines.map((l) => (
                  <li key={`${l.line.productId}-${l.line.variantId}`} className="text-sm text-ink/80">
                    {l.line.qty} × {l.product.title[locale]}
                    <span className="text-ink/50"> · {l.variant.label[locale]}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                {first && (
                  <Link
                    href={`/${locale}/product/${first.product.slug}`}
                    className="font-mono text-[11px] uppercase tracking-[0.16em] text-rouge underline-offset-4 hover:underline"
                  >
                    {t("order_again")} →
                  </Link>
                )}
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
                  {order.fulfillment.method === "pickup" ? t("picked_up") : t("delivered_to")}
                  {order.fulfillment.method === "delivery"
                    ? ` ${order.fulfillment.address.city}`
                    : ""}
                </span>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
