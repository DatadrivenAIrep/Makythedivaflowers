import * as React from "react";
import { cn } from "@/lib/cn";

export const DateInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => {
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <input
      ref={ref}
      type="date"
      className={cn(
        "block w-full bg-bone rounded-lg px-4 py-3 font-mono text-sm text-ink",
        "outline-none transition-colors duration-200",
        isInvalid
          ? "border border-rouge focus:ring-2 focus:ring-rouge/20"
          : "border border-ink/15 hover:border-ink/30 focus:border-rouge focus:ring-2 focus:ring-rouge/20",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
DateInput.displayName = "DateInput";
