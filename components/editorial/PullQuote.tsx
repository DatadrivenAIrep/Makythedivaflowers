// components/editorial/PullQuote.tsx
type Props = { children: React.ReactNode; cite?: string };
export function PullQuote({ children, cite }: Props) {
  return (
    <figure className="my-12 max-w-4xl mx-auto rounded-[2rem] bg-lilac/30 px-8 py-12 sm:px-16 sm:py-20">
      <blockquote className="font-display text-3xl sm:text-5xl text-ink leading-[1.05] tracking-tighter">
        &ldquo;{children}&rdquo;
      </blockquote>
      {cite && (
        <figcaption className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
          — {cite}
        </figcaption>
      )}
    </figure>
  );
}
