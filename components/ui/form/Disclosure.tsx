import type { ReactNode } from "react";

export function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-ink/10 pt-4">
      <summary className="cursor-pointer list-none font-mono text-[12px] uppercase tracking-[0.16em] text-ink/60 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="transition-transform group-open:rotate-45">+</span>
          {summary}
        </span>
      </summary>
      <div className="mt-6 space-y-6">{children}</div>
    </details>
  );
}
