import * as React from "react";

type Step = { title: string; body: string };

type Props = {
  eyebrow: string;
  title: string;
  body?: string;
  steps?: ReadonlyArray<Step>;
  signature?: string;
};

export function EditorialPanel({ eyebrow, title, body, steps, signature }: Props) {
  return (
    <div className="relative h-full min-h-[280px] md:min-h-[640px] overflow-hidden bg-gradient-to-br from-ink to-[#2a1a16] text-bone">
      <div
        aria-hidden="true"
        className="absolute -right-12 -bottom-16 h-72 w-72 rounded-full bg-rouge/30 blur-3xl"
      />
      <div className="relative z-10 flex h-full flex-col justify-between p-6 md:p-12">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge mb-3">
            {eyebrow}
          </p>
          <h2 className="font-display text-3xl md:text-4xl tracking-tighter leading-[0.95] mb-4 max-w-md">
            {title}
          </h2>
          {body && (
            <p className="font-sans text-sm leading-relaxed text-bone/85 max-w-md hidden md:block">
              {body}
            </p>
          )}
          {steps && steps.length > 0 && (
            <ol className="mt-8 flex flex-col gap-4 max-w-md">
              {steps.map((s, i) => (
                <li key={i} className="flex items-baseline gap-3">
                  <span className="font-display text-lg text-rouge tracking-tight w-6 flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-bone/85">
                    <strong className="text-bone font-medium">{s.title}</strong>
                    <br />
                    {s.body}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {signature && (
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/45 hidden md:block">
            {signature}
          </p>
        )}
      </div>
    </div>
  );
}
