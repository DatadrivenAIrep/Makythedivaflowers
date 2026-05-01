export default function Home() {
  return (
    <main className="min-h-[100dvh] grid place-items-center bg-bone text-ink">
      <div className="space-y-6 text-center">
        <h1 style={{ fontFamily: "var(--font-display)" }} className="text-6xl tracking-tighter">
          Diva Flowers
        </h1>
        <div className="flex gap-3 justify-center">
          <span className="size-12 rounded-full bg-petal" />
          <span className="size-12 rounded-full bg-rouge" />
          <span className="size-12 rounded-full bg-ink" />
          <span className="size-12 rounded-full bg-lilac" />
          <span className="size-12 rounded-full bg-mute-400" />
        </div>
      </div>
    </main>
  );
}
