export default function ProductLoading() {
  return (
    <main className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-10 px-6 pt-10 pb-16 lg:grid-cols-12 lg:gap-12 lg:pt-16">
      <div className="lg:col-span-7">
        <div className="aspect-[4/5] animate-pulse rounded-[var(--radius-product)] bg-mute-100" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-[var(--radius-product)] bg-mute-100" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-5 lg:col-span-5 lg:pt-4">
        <div className="h-3 w-32 animate-pulse rounded bg-mute-100" />
        <div className="h-14 w-4/5 animate-pulse rounded bg-mute-100" />
        <div className="h-4 w-full animate-pulse rounded bg-mute-100" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-mute-100" />
        <div className="mt-4 h-12 w-full animate-pulse rounded-full bg-mute-100" />
      </div>
    </main>
  );
}
