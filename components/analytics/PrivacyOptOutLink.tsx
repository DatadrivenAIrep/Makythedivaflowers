"use client";
import { setConsent } from "@/lib/consent";

export function PrivacyOptOutLink({ className }: { className?: string }) {
  function optOut(e: React.MouseEvent) {
    e.preventDefault();
    setConsent(false);
    window.location.reload();
  }

  return (
    <a
      href="#"
      onClick={optOut}
      className={className ?? "text-[12px] font-mono uppercase tracking-[0.18em] underline"}
    >
      Do Not Sell or Share My Personal Information
    </a>
  );
}
