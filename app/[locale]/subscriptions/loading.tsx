// app/[locale]/subscriptions/loading.tsx
export default function SubscriptionsLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      {/* Hero skeleton */}
      <div className="h-3 w-28 animate-pulse rounded bg-mute-100" />
      <div className="mt-3 h-16 w-3/4 animate-pulse rounded bg-mute-100" />
      <div className="mt-6 h-4 w-1/2 animate-pulse rounded bg-mute-100" />
      <div className="mt-2 h-4 w-2/5 animate-pulse rounded bg-mute-100" />

      {/* Tiers skeleton */}
      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-[var(--radius-bento)] bg-mute-100"
          />
        ))}
      </section>

      {/* How it works skeleton */}
      <section className="mt-16 border-t border-ink/10 pt-16">
        <div className="h-10 w-1/2 animate-pulse rounded bg-mute-100" />
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="h-3 w-8 animate-pulse rounded bg-mute-100" />
              <div className="h-6 w-3/4 animate-pulse rounded bg-mute-100" />
              <div className="h-4 w-full animate-pulse rounded bg-mute-100" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-mute-100" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
