import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  num?: number;
  className?: string;
};

export function FormSection({ title, num, className }: Props) {
  const numStr = num !== undefined ? String(num).padStart(2, "0") : null;
  return (
    <div
      className={cn(
        "flex items-baseline gap-2.5 border-t border-ink/10 pt-3 mb-4",
        className,
      )}
    >
      {numStr && (
        <span className="font-display text-sm tracking-tight text-ink/40 leading-none">
          {numStr}
        </span>
      )}
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge">
        {title}
      </span>
    </div>
  );
}
