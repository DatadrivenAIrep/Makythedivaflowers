"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

// Translucent material surface (Apple §12): bright top edge, blur+saturate,
// content scrolls under. Materializes (blur+scale) on enter, not a flat fade.
const materialSurface =
  "[background:var(--material-bg-strong)] [backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] " +
  "[-webkit-backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] " +
  "[box-shadow:inset_0_1px_0_var(--material-edge),var(--shadow-diffusion)] text-[var(--fg)]";

export function SheetContent({
  children,
  side = "right",
  className,
  ...rest
}: {
  children: React.ReactNode;
  side?: "right" | "bottom";
  className?: string;
} & Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
>) {
  const reduce = useReducedMotion();
  const slideInitial = side === "right" ? { x: "100%" } : { y: "100%" };
  const slideExit = side === "right" ? { x: "100%" } : { y: "100%" };

  return (
    <Dialog.Portal forceMount>
      <AnimatePresence>
        <Dialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-50 bg-ink/30 [backdrop-filter:blur(6px)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            {...rest}
            className={cn(
              "fixed z-50",
              side === "right" && "top-0 right-0 h-full w-full sm:max-w-md p-8 border-l border-[var(--border)]",
              side === "bottom" && "bottom-0 inset-x-0 max-h-[85dvh] p-8 rounded-t-[var(--radius-bento)]",
              materialSurface,
              className,
            )}
            initial={reduce ? false : slideInitial}
            animate={reduce ? {} : { x: 0, y: 0 }}
            exit={reduce ? {} : slideExit}
            transition={reduce ? { duration: 0 } : SPRING.drawer}
          >
            {side === "bottom" && (
              <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--fg)]/20" />
            )}
            {children}
          </motion.div>
        </Dialog.Content>
      </AnimatePresence>
    </Dialog.Portal>
  );
}
