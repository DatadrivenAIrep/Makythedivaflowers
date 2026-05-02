import * as React from "react";
import { cn } from "@/lib/cn";

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  loading?: boolean;
  fullWidth?: boolean;
};

export const FormSubmit = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, loading, fullWidth = true, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="submit"
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          "bg-ink text-bone hover:bg-rouge",
          "px-8 py-4 min-h-[52px] font-sans text-sm font-medium tracking-tight",
          "transition-colors duration-200 outline-none",
          "focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          fullWidth ? "w-full sm:w-auto sm:self-end" : "",
          className,
        )}
        {...props}
      >
        {loading ? <LoadingDots /> : children}
      </button>
    );
  },
);
FormSubmit.displayName = "FormSubmit";

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Loading">
      <span className="h-1 w-1 rounded-full bg-bone animate-pulse [animation-delay:-0.3s]" />
      <span className="h-1 w-1 rounded-full bg-bone animate-pulse [animation-delay:-0.15s]" />
      <span className="h-1 w-1 rounded-full bg-bone animate-pulse" />
    </span>
  );
}
