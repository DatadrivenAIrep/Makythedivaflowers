import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "outline" | "link";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-rouge text-bone hover:bg-rouge-glow rounded-2xl rounded-t-[var(--radius-arch-top)] active:scale-[0.98]",
  ghost: "bg-transparent text-ink hover:bg-ink/[0.04] rounded-full",
  outline: "bg-transparent text-ink border border-ink/15 hover:border-ink/35 rounded-full",
  link: "bg-transparent text-ink underline-offset-4 hover:underline",
};
const sizeClass: Record<Size, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-3 text-base",
  lg: "px-6 py-4 text-base",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    variant?: Variant;
    size?: Size;
  }
>(({ className, variant = "primary", size = "md", asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-sans font-medium tracking-tight transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2 focus-visible:ring-offset-bone disabled:opacity-50",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";
