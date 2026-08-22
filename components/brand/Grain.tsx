import { cn } from "@/lib/cn";

export function Grain({
  className = "fixed z-[60] opacity-[0.04]",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none inset-0 mix-blend-multiply",
        className,
      )}
      style={{
        backgroundImage: "url(/grain.svg)",
        backgroundSize: "256px 256px",
      }}
    />
  );
}
