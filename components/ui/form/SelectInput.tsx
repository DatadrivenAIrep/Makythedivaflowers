import * as React from "react";
import { cn } from "@/lib/cn";

export const SelectInput = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <select
      ref={ref}
      className={cn(
        "block w-full bg-bone rounded-lg px-4 py-3 font-sans text-base text-ink appearance-none",
        "outline-none transition-colors duration-200 cursor-pointer",
        isInvalid
          ? "border border-rouge focus:ring-2 focus:ring-rouge/20"
          : "border border-ink/15 hover:border-ink/30 focus:border-rouge focus:ring-2 focus:ring-rouge/20",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
SelectInput.displayName = "SelectInput";
