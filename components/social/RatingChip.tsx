// components/social/RatingChip.tsx
export function RatingChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-bone/40 bg-ink/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-bone/90 backdrop-blur-sm">
      {label}
    </span>
  );
}
