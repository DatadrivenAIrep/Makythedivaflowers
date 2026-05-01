"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({
  children,
  side = "right",
  className,
}: {
  children: React.ReactNode;
  side?: "right" | "bottom";
  className?: string;
}) {
  return (
    <Dialog.Portal forceMount>
      <AnimatePresence>
        <Dialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            className={cn(
              "fixed z-50 bg-bone text-ink shadow-[var(--shadow-diffusion)]",
              side === "right" && "top-0 right-0 h-full w-full sm:max-w-md p-8 border-l border-ink/10",
              side === "bottom" && "bottom-0 inset-x-0 max-h-[85dvh] p-8 rounded-t-[var(--radius-bento)] border-t border-ink/10",
              "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.6)]",
              className,
            )}
            initial={side === "right" ? { x: "100%" } : { y: "100%" }}
            animate={side === "right" ? { x: 0 } : { y: 0 }}
            exit={side === "right" ? { x: "100%" } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
          >
            {children}
          </motion.div>
        </Dialog.Content>
      </AnimatePresence>
    </Dialog.Portal>
  );
}
