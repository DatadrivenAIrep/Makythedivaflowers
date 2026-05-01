export function CardMessageSkeleton() {
  return (
    <div
      className="flex flex-col gap-2"
      aria-live="polite"
      aria-busy="true"
      data-testid="card-message-skeleton"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-[var(--radius-product)] border border-ink/10 bg-ink/5 px-4 py-3"
        >
          <div className="h-3 w-3/4 animate-pulse rounded bg-ink/10" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-ink/10" />
        </div>
      ))}
      <span className="sr-only">Generating suggestions…</span>
    </div>
  );
}
