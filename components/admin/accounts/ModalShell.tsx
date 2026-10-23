"use client";
import { useEffect, useId, useRef } from "react";

type Props = { title: string; onClose: () => void; children: React.ReactNode };

/** Shared dialog chrome for the account modals: backdrop click and Escape close it, focus returns to the opener. */
export default function ModalShell({ title, onClose, children }: Props) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Captured during the first render, before children mount: an autoFocus child is focused at commit,
  // which is before any effect runs, so reading activeElement in an effect would find the modal's own input.
  const openerRef = useRef<HTMLElement | null | undefined>(undefined);
  if (openerRef.current === undefined) {
    openerRef.current = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
  }

  useEffect(() => {
    const opener = openerRef.current;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCloseRef.current(); }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && opener !== document.body && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-xl bg-bone p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
