// components/inquiry/WhatHappensNext.tsx
export function WhatHappensNext({
  title,
  steps,
}: {
  title: string;
  steps: string[];
}) {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
          {title}
        </h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={i} className="flex flex-col gap-3">
              <span aria-hidden="true" className="font-display text-3xl text-ink/30">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-base leading-relaxed text-ink/80">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
