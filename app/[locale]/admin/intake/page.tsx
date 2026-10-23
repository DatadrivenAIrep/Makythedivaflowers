import Link from "next/link";
import { getTranslations } from "next-intl/server";
import IntakeForm from "@/components/admin/intake/IntakeForm";
import { LocaleSwitcher } from "@/components/nav/LocaleSwitcher";
import type { Locale } from "@/types/locale";
import { PRODUCTS } from "@/data/products";
import { getAllPriceOverrides, applyPriceOverrides } from "@/lib/product-prices";
import { getOrder } from "@/lib/order-storage";
import { repeatOrderPayload } from "@/lib/repeat-order";

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations("admin_dashboard");
  const ti = await getTranslations("admin_intake");
  const products = applyPriceOverrides(PRODUCTS, getAllPriceOverrides());
  // "Repetir orden" from an order's detail: start from that order.
  const repeatId = typeof sp.repeat === "string" ? sp.repeat : undefined;
  const repeatOrder = repeatId ? await getOrder(repeatId) : null;
  const repeat = repeatOrder ? repeatOrderPayload(repeatOrder, products) : null;
  return (
    <>
      <div className="sticky top-0 z-10 border-b border-ink/10 bg-bone/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2 text-sm">
          <Link
            href={`/${locale}/admin/dashboard`}
            className="rounded border border-ink/20 px-3 py-1 hover:bg-ink/5"
          >← {t("nav_bandeja")}</Link>
          <span className="font-semibold tracking-wide">{ti("title_new")}</span>
          <div className="ml-auto"><LocaleSwitcher current={locale as Locale} /></div>
        </div>
      </div>
      <IntakeForm
        // A new key per repeated order, so moving between them starts each form fresh.
        key={repeat?.from.id ?? "new"}
        products={products}
        repeat={repeat}
        repeatMissing={Boolean(repeatId) && !repeat}
      />
    </>
  );
}
