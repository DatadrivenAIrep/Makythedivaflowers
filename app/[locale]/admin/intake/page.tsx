import Link from "next/link";
import IntakeForm from "@/components/admin/intake/IntakeForm";
import { PRODUCTS } from "@/data/products";
import { getAllPriceOverrides, applyPriceOverrides } from "@/lib/product-prices";

export default async function IntakePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const products = applyPriceOverrides(PRODUCTS, getAllPriceOverrides());
  return (
    <>
      <div className="sticky top-0 z-10 border-b border-ink/10 bg-bone/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2 text-sm">
          <Link
            href={`/${locale}/admin/dashboard`}
            className="rounded border border-ink/20 px-3 py-1 hover:bg-ink/5"
          >← Bandeja</Link>
          <span className="font-semibold tracking-wide">Nueva orden</span>
        </div>
      </div>
      <IntakeForm products={products} />
    </>
  );
}
