"use client";
import { useEffect, useId } from "react";

type Props = { title: string; onClose: () => void; children: React.ReactNode };

/** Shared dialog chrome for the account modals: backdrop click and Escape close it. */
export default function ModalShell({ title, onClose, children }: Props) {
  const titleId = useId();
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-xl bg-bone p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
