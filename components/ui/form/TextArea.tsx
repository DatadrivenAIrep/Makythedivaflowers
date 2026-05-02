import * as React from "react";
import { cn } from "@/lib/cn";

export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <textarea
      ref={ref}
      className={cn(
        "block w-full bg-bone rounded-lg px-4 py-3.5 min-h-[110px] resize-none",
        "font-sans text-base text-ink placeholder:text-mute-400",
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
TextArea.displayName = "TextArea";
