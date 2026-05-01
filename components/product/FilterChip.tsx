"use client";
import { memo } from "react";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  selected: boolean;
  onToggle: () => void;
  ariaLabel?: string;
};

function FilterChipImpl({ label, selected, onToggle, ariaLabel }: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel ?? label}
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 font-sans text-sm tracking-tight transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
        selected
          ? "border-transparent bg-rouge text-bone"
          : "border-ink/15 bg-transparent text-ink/80 hover:border-ink/35",
      )}
    >
      {label}
    </button>
  );
}

export const FilterChip = memo(FilterChipImpl);
