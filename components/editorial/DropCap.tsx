// components/editorial/DropCap.tsx
export function DropCap({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base sm:text-lg text-ink/85 leading-relaxed max-w-[68ch] [&::first-letter]:font-display [&::first-letter]:text-7xl [&::first-letter]:leading-[0.85] [&::first-letter]:float-left [&::first-letter]:mr-3 [&::first-letter]:mt-1 [&::first-letter]:text-rouge">
      {children}
    </p>
  );
}
