// components/inquiry/WhatsAppCta.tsx
import { SITE } from "@/data/site";
import { buildWhatsappHref } from "@/lib/text-maky-links";
import { cn } from "@/lib/cn";

export function WhatsAppCta({
  label,
  message,
  className,
}: {
  label: string;
  message: string;
  className?: string;
}) {
  return (
    <a
      href={buildWhatsappHref(SITE.mobile.e164, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full border border-bone/40 px-5 py-3 font-sans text-sm tracking-tight text-bone transition-colors hover:border-bone",
        className,
      )}
    >
      {label}
    </a>
  );
}
