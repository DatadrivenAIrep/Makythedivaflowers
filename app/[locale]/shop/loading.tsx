// app/[locale]/shop/loading.tsx
import { ProductCardSkeleton } from "@/components/product/ProductCardSkeleton";

export default function ShopHubLoading() {
  return (
    <main className="bg-bone text-ink">
      <header className="mx-auto max-w-[var(--container-max)] px-6 pt-16 pb-10">
        <div className="h-3 w-24 animate-pulse rounded bg-mute-100" />
        <div className="mt-3 h-14 w-3/4 animate-pulse rounded bg-mute-100" />
      </header>
      <section className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-5 px-6 pb-16 md:grid-cols-12">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[5/4] animate-pulse rounded-[var(--radius-bento)] bg-mute-100 md:col-span-4" />
        ))}
      </section>
      <section className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-x-6 gap-y-12 px-6 pb-24 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </section>
    </main>
  );
}
