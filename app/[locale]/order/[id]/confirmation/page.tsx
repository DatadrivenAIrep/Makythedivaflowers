import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ConfirmationView } from "@/components/checkout/ConfirmationView";
import { getOrder } from "@/lib/order-storage";
import type { Locale } from "@/types/locale";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { resolveCartLines } from "@/lib/cart-helpers";
import { resolvedLineToAnalyticsItem, centsToDollars } from "@/lib/analytics-types";
import { PRODUCTS } from "@/data/products";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale; id: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "confirmation" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    robots: { index: false, follow: false },
  };
}

export default async function ConfirmationPage({
  params,
}: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      {(() => {
        const resolved = resolveCartLines(order.lines, PRODUCTS);
        return (
          <TrackEvent
            kind="purchase"
            payload={{
              transaction_id: order.id,
              value: centsToDollars(order.totals.totalCents),
              tax: centsToDollars(order.totals.taxCents),
              shipping: centsToDollars(order.totals.deliveryCents),
              items: resolved.map(resolvedLineToAnalyticsItem),
            }}
          />
        );
      })()}
      <ConfirmationView order={order} locale={locale} />
    </main>
  );
}
