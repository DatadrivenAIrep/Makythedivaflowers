"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function LocaleError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="bg-bone text-ink flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-mute-400">
        Something went wrong
      </p>
      <h1 className="font-display mt-4 text-4xl font-light leading-tight md:text-6xl">
        A petal fell
        <br />
        out of place.
      </h1>
      <p className="mt-6 max-w-sm text-mute-500">
        We ran into an unexpected issue. Give us a moment — flowers are patient
        things.
      </p>
      {error.digest && (
        <p className="font-mono mt-4 text-xs text-mute-300">
          ref: {error.digest}
        </p>
      )}
      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <button
          onClick={() => unstable_retry()}
          className="rounded-full bg-rouge px-8 py-3 text-sm font-medium text-bone transition-opacity hover:opacity-90"
        >
          Try again
        </button>
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
