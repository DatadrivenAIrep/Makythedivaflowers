"use client";
import { memo } from "react";
import type { Sort } from "@/data/product-helpers";

type Option = { value: Sort; label: string };

type Props = {
  value: Sort;
  options: Option[];
  onChange: (s: Sort) => void;
  ariaLabel: string;
};

function SortDropdownImpl({ value, options, onChange, ariaLabel }: Props) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {ariaLabel}
      </span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as Sort)}
        className="h-9 rounded-full border border-ink/15 bg-transparent pl-3 pr-8 font-sans text-sm tracking-tight text-ink/90 hover:border-ink/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export const SortDropdown = memo(SortDropdownImpl);
