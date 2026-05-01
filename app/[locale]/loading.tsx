// app/[locale]/loading.tsx — home page skeleton
export default function HomeLoading() {
  return (
    <main className="bg-bone text-ink">
      {/* Hero skeleton */}
      <div className="relative flex min-h-[100dvh] flex-col justify-end overflow-hidden">
        <div className="absolute inset-0 animate-pulse bg-mute-100" />
        <div className="relative mx-auto w-full max-w-[var(--container-max)] px-6 pb-16">
          <div className="h-3 w-24 animate-pulse rounded bg-mute-200" />
          <div className="mt-4 h-16 w-2/3 animate-pulse rounded bg-mute-200 md:h-24" />
          <div className="mt-4 h-16 w-1/2 animate-pulse rounded bg-mute-200 md:h-24" />
          <div className="mt-8 h-12 w-40 animate-pulse rounded-full bg-mute-200" />
        </div>
      </div>

      {/* Marquee skeleton */}
      <div className="h-10 w-full animate-pulse bg-mute-100" />

      {/* Bento grid skeleton */}
      <section className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-4 px-6 py-12 md:grid-cols-12">
        <div className="aspect-square animate-pulse rounded-[var(--radius-bento)] bg-mute-100 md:col-span-8 md:aspect-auto md:min-h-[480px]" />
        <div className="flex flex-col gap-4 md:col-span-4">
          <div className="h-48 animate-pulse rounded-[var(--radius-bento)] bg-mute-100" />
          <div className="h-48 animate-pulse rounded-[var(--radius-bento)] bg-mute-100" />
        </div>
        <div className="h-40 animate-pulse rounded-[var(--radius-bento)] bg-mute-100 md:col-span-4" />
        <div className="h-40 animate-pulse rounded-[var(--radius-bento)] bg-mute-100 md:col-span-4" />
        <div className="h-40 animate-pulse rounded-[var(--radius-bento)] bg-mute-100 md:col-span-4" />
      </section>
    </main>
  );
}
