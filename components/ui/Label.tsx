"use client";
import * as React from "react";
import * as RadixLabel from "@radix-ui/react-label";
import { cn } from "@/lib/cn";

export const Label = React.forwardRef<
  React.ElementRef<typeof RadixLabel.Root>,
  React.ComponentPropsWithoutRef<typeof RadixLabel.Root>
>(({ className, ...props }, ref) => (
  <RadixLabel.Root
    ref={ref}
    className={cn("font-mono text-xs uppercase tracking-[0.18em] text-mute-500", className)}
    {...props}
  />
));
Label.displayName = "Label";
