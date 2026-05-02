import * as React from "react";
import { cn } from "@/lib/cn";

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => {
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "block w-full bg-transparent border-0 border-b py-3 px-0",
        "font-sans text-base text-ink placeholder:text-mute-400",
        "outline-none transition-colors duration-200",
        isInvalid
          ? "border-b-[1.5px] border-rouge"
          : "border-b border-ink/20 hover:border-ink/35 focus:border-b-[1.5px] focus:border-rouge",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
});
TextInput.displayName = "TextInput";
