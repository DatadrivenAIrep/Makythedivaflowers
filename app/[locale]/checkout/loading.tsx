export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <div className="h-12 w-72 bg-ink/5 rounded-md animate-pulse" />
      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-ink/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-ink/5 rounded-2xl animate-pulse" />
      </div>
    </main>
  );
}
