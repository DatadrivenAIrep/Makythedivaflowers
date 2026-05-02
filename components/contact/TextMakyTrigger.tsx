"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";
import { isAllowlistedRoute } from "@/lib/contact-subject";
import { useContactContext } from "@/components/contact/ContactContextProvider";
import { TextMakyModal } from "@/components/contact/TextMakyModal";

export function TextMakyTrigger() {
  const t = useTranslations("text_modal");
  const pathname = usePathname() ?? "/";
  const { setOpen, open } = useContactContext();
  const visible = isAllowlistedRoute(pathname);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={t("trigger")}
            className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-bone shadow-[var(--shadow-diffusion)] transition-colors hover:bg-rouge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
          >
            <ChatCircleText size={18} weight="regular" aria-hidden />
            <span className="font-sans text-sm font-medium tracking-tight">{t("trigger")}</span>
          </motion.button>
        )}
      </AnimatePresence>
      <TextMakyModal />
    </>
  );
}
