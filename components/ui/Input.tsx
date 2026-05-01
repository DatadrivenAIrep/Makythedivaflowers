import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full bg-transparent border-b border-ink/20 py-3 px-1 text-base placeholder:text-mute-400 outline-none focus:border-rouge transition-colors",
      "font-mono",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
