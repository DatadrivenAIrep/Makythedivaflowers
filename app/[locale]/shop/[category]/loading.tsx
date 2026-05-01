// app/[locale]/shop/[category]/loading.tsx
import { ProductCardSkeleton } from "@/components/product/ProductCardSkeleton";

export default function CategoryLoading() {
  return (
    <main className="bg-bone text-ink">
      <header className="mx-auto max-w-[var(--container-max)] px-6 pt-12 pb-6 md:pt-20">
        <div className="h-3 w-24 animate-pulse rounded bg-mute-100" />
        <div className="mt-3 h-14 w-1/2 animate-pulse rounded bg-mute-100" />
        <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-mute-100" />
      </header>
      <div className="sticky top-16 z-30 -mx-6 border-y border-ink/10 bg-bone/85 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[var(--container-max)] gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-mute-100" />
          ))}
        </div>
      </div>
      <section className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-x-6 gap-y-12 px-6 py-10 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </section>
    </main>
  );
}
