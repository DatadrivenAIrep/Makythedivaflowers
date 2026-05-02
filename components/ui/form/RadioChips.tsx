import * as React from "react";
import { cn } from "@/lib/cn";

type Item = { value: string; label: string };

type Props = {
  name: string;
  items: ReadonlyArray<Item>;
  value: string | undefined;
  onChange: (value: string) => void;
  cols?: 2 | 3 | 4;
  className?: string;
  "aria-describedby"?: string;
};

export function RadioChips({ name, items, value, onChange, cols = 4, className, ...rest }: Props) {
  const colsCls = cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";
  return (
    <div
      role="radiogroup"
      aria-describedby={rest["aria-describedby"]}
      className={cn("grid grid-cols-2 gap-2", colsCls, className)}
    >
      {items.map((it) => {
        const isActive = value === it.value;
        const id = `${name}-${it.value}`;
        return (
          <label
            key={it.value}
            htmlFor={id}
            className={cn(
              "cursor-pointer rounded-xl border px-4 py-3.5 text-center font-sans text-sm",
              "min-h-[52px] flex items-center justify-center transition-colors duration-200",
              isActive
                ? "border-rouge bg-rouge/[0.08] text-ink"
                : "border-ink/15 text-ink/70 hover:border-ink/30",
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={it.value}
              checked={isActive}
              onChange={() => onChange(it.value)}
              className="sr-only"
            />
            {it.label}
          </label>
        );
      })}
    </div>
  );
}
