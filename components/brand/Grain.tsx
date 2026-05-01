import { cn } from "@/lib/cn";

export function Grain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-[60] mix-blend-multiply opacity-[0.04]",
        className,
      )}
      style={{
        backgroundImage: "url(/grain.svg)",
        backgroundSize: "256px 256px",
      }}
    />
  );
}
