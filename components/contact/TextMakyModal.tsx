"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { ChatCircleText, Phone, WhatsappLogo, X } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { SITE } from "@/data/site";
import { getSubjectKey } from "@/lib/contact-subject";
import { buildSmsHref, buildTelHref, buildWhatsappHref } from "@/lib/text-maky-links";
import { useContactContext } from "@/components/contact/ContactContextProvider";
import { trackWhatsappClick } from "@/lib/analytics";

export function TextMakyModal() {
  const t = useTranslations("text_modal");
  const pathname = usePathname() ?? "/";
  const { override, open, setOpen } = useContactContext();

  const { key, vars } = getSubjectKey({ pathname, override });
  const greeting = t("greeting");
  const subject = t(`subjects.${key}`, vars ?? {});
  const productUrl = key === "pdp_named" ? `${SITE.url}${pathname}` : null;
  const message = productUrl
    ? `${greeting}${subject} ${productUrl}`
    : `${greeting}${subject}`;

  const smsHref = buildSmsHref(SITE.mobile.e164, message);
  const whatsappHref = buildWhatsappHref(SITE.mobile.e164, message);
  const telHref = buildTelHref(SITE.mobile.e164);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <>
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
                    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[var(--radius-bento)] border-t border-ink/10 p-8",
                    "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2",
                    "md:w-[min(28rem,calc(100vw-3rem))] md:max-h-none md:rounded-[var(--radius-bento)] md:border md:border-ink/10",
                    "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.6)]",
                  )}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "100%", opacity: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 28 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="font-display text-2xl text-ink">
                        {t("title")}
                      </Dialog.Title>
                      <Dialog.Description className="mt-1 text-sm text-ink/60">
                        {t("subtitle")}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        aria-label={t("close")}
                        className="rounded-full p-2 text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
                      >
                        <X size={18} weight="regular" aria-hidden />
                      </button>
                    </Dialog.Close>
                  </div>

                  <div
                    role="region"
                    aria-label={t("preview_label")}
                    className="mt-6 rounded-xl border border-ink/10 bg-ink/[0.03] p-4"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">
                      {t("preview_label")}
                    </p>
                    <p className="mt-1.5 font-display text-[15px] italic leading-relaxed text-ink/80">
                      {message}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-col gap-2">
                    <Button asChild variant="primary" size="md" className="w-full justify-center">
                      <a href={smsHref} aria-label={`${t("send_sms")} (${SITE.mobile.display})`}>
                        <ChatCircleText size={18} weight="regular" className="mr-2" aria-hidden />
                        {t("send_sms")}
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="md" className="w-full justify-center">
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t("send_whatsapp")} (${SITE.mobile.display})`}
                        onClick={() => trackWhatsappClick("contact", "text-maky-modal")}
                      >
                        <WhatsappLogo size={18} weight="regular" className="mr-2" aria-hidden />
                        {t("send_whatsapp")}
                      </a>
                    </Button>
                    <Button asChild variant="ghost" size="md" className="w-full justify-center">
                      <a href={telHref} aria-label={`${t("call")} (${SITE.mobile.display})`}>
                        <Phone size={18} weight="regular" className="mr-2" aria-hidden />
                        {t("call")}
                      </a>
                    </Button>
                  </div>

                  <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
                    {t("footer_note")}
                  </p>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
