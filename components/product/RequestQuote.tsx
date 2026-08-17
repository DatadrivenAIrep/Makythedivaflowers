"use client";
import { memo } from "react";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { useContactContext } from "@/components/contact/ContactContextProvider";
import type { Locale } from "@/types/locale";

/**
 * PDP call-to-action for quote-only products. Opens the site-wide "Text Maky"
 * modal (WhatsApp / SMS / call), which is already pre-filled with this
 * product's name + URL via PdpContactSubject. No cart, no price.
 */
function RequestQuoteImpl({ locale }: { locale: Locale }) {
  const { setOpen } = useContactContext();
  return (
    <MagneticButton
      type="button"
      onClick={() => setOpen(true)}
      className="w-full justify-center gap-2"
      wrapperClassName="w-full"
    >
      <WhatsappLogo size={18} weight="regular" aria-hidden />
      {locale === "es" ? "Solicitar cotización" : "Request a quote"}
    </MagneticButton>
  );
}

export const RequestQuote = memo(RequestQuoteImpl);
