export function ProductCardSkeleton() {
  return (
    <div className="block">
      <div className="aspect-[4/5] animate-pulse rounded-[var(--radius-product)] bg-mute-100" />
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="h-5 w-2/3 animate-pulse rounded bg-mute-100" />
        <div className="h-4 w-16 animate-pulse rounded bg-mute-100" />
      </div>
    </div>
  );
}
