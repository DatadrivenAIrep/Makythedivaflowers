import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  left: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  formId?: string;
};

export function FormShell({ left, children, className, formId = "form-content" }: Props) {
  return (
    <section className={cn("relative", className)}>
      <a
        href={`#${formId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:bg-ink focus:text-bone focus:px-4 focus:py-2 focus:rounded-md focus:font-mono focus:text-xs"
      >
        Skip to form
      </a>
      <div className="grid md:grid-cols-[42fr_58fr] min-h-[640px]">
        <div className="relative overflow-hidden md:min-h-full min-h-[280px]">
          {left}
        </div>
        <div id={formId} className="bg-bone px-6 py-10 md:px-12 md:py-14">
          {children}
        </div>
      </div>
    </section>
  );
}
