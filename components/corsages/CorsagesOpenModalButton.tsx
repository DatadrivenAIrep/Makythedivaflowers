"use client";
import * as React from "react";
import { useContactContext } from "@/components/contact/ContactContextProvider";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
};

export function CorsagesOpenModalButton({
  children,
  variant = "primary",
  className,
}: Props) {
  const { setOpen } = useContactContext();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-6 py-3 font-sans text-sm tracking-tight transition",
        variant === "primary" &&
          "bg-ink text-bone hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40",
        variant === "ghost" &&
          "border border-ink/30 text-ink hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        className,
      )}
    >
      {children}
    </button>
  );
}
