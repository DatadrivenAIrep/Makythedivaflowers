"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react/dist/ssr";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";

export function TikTokLightbox({
  videoId,
  url,
  open,
  onOpenChange,
  locale: _locale,
}: {
  videoId: string;
  url: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  locale: Locale;
}) {
  const t = useTranslations("home.tiktok.lightbox");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <>
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-md"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <motion.div
                  className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 md:p-8"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 220, damping: 28 }}
                >
                  <Dialog.Title className="sr-only">{t("video_label")}</Dialog.Title>
                  <Dialog.Close
                    aria-label={t("close")}
                    className="absolute top-4 right-4 size-10 rounded-full bg-bone/15 text-bone hover:bg-bone/25 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone/50"
                  >
                    <X size={20} weight="bold" />
                  </Dialog.Close>

                  <div className="w-full max-w-[min(420px,90vw)] aspect-[9/16] rounded-xl overflow-hidden bg-ink">
                    <iframe
                      src={`https://www.tiktok.com/embed/v2/${videoId}`}
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                      allowFullScreen
                      className="size-full"
                      title={t("video_label")}
                    />
                  </div>

                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 font-sans text-sm text-bone underline underline-offset-4 hover:no-underline"
                  >
                    {t("view_on_tiktok")} →
                  </a>
                </motion.div>
              </Dialog.Content>
            </>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
