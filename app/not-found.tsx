import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-bone px-6 text-center text-ink">
      <p className="font-mono text-xs uppercase tracking-widest text-mute-300">
        404
      </p>
      <h1 className="font-display mt-4 text-4xl font-light leading-tight md:text-6xl">
        Page not found.
      </h1>
      <p className="mt-6 max-w-[26rem] leading-relaxed text-mute-500">
        The page you&apos;re looking for has moved, been removed, or never
        existed. Let&apos;s find you something beautiful instead.
      </p>
      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <Link
          href="/en/shop"
          className="rounded-full bg-rouge px-8 py-3 text-sm font-medium text-bone transition-opacity hover:opacity-90"
        >
          Browse flowers
        </Link>
        <Link
          href="/"
          className="text-sm text-mute-500 underline-offset-4 hover:underline"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
