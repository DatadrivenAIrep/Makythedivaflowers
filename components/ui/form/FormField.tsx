import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  htmlFor: string;
  required?: boolean;
  help?: string;
  error?: string | false | null;
  className?: string;
  children: React.ReactNode;
};

export function FormField({ label, htmlFor, required, help, error, className, children }: Props) {
  const helpId = help ? `${htmlFor}-help` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("block", className)}>
      <label
        htmlFor={htmlFor}
        className="mb-2 block font-mono text-[12px] uppercase tracking-[0.16em] text-ink/70"
      >
        {label}
        {required && <span className="ml-0.5 text-rouge" aria-hidden="true">*</span>}
      </label>
      {children}
      {help && (
        <p id={helpId} className="mt-1.5 font-mono text-[11px] text-ink/55 leading-relaxed">
          {help}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 font-mono text-[11px] text-error leading-relaxed"
        >
          {error}
        </p>
      )}
    </div>
  );
}
