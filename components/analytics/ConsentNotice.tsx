"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { setConsent, COOKIE_NAME } from "@/lib/consent";

export function ConsentNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasCookie = document.cookie.split("; ").some((r) => r.startsWith(`${COOKIE_NAME}=`));
    if (!hasCookie) setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    setConsent(true);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-[60] bg-bone text-ink rounded-lg shadow-lg border border-ink/10 p-4 flex items-start gap-3"
    >
      <p className="text-[13px] leading-snug flex-1">
        We use cookies for analytics.{" "}
        <Link href="/en/legal/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="text-[12px] font-mono uppercase tracking-[0.18em] underline shrink-0"
      >
        Got it
      </button>
    </div>
  );
}
