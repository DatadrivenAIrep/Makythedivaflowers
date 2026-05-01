import Link from "next/link";
import { cn } from "@/lib/cn";

export function Wordmark({
  locale,
  size = "default",
  className,
}: {
  locale: "en" | "es";
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <Link
      href={`/${locale}`}
      aria-label="Diva Flowers — Home"
      className={cn(
        "font-display tracking-tighter leading-none text-ink select-none",
        size === "default" ? "text-2xl md:text-3xl" : "text-lg",
        className,
      )}
      style={{ fontFeatureSettings: "'ss01' on, 'ss02' on", fontVariationSettings: "'WONK' 1, 'SOFT' 60" }}
    >
      <span aria-hidden>Diva</span>
      <span aria-hidden className="italic"> Flowers</span>
    </Link>
  );
}
