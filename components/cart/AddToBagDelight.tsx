// components/cart/AddToBagDelight.tsx
"use client";
import { useEffect, useState } from "react";
import { useUIStore } from "@/lib/ui-store";
import { PetalRain } from "@/components/home/PetalRain";

// One-shot petal burst when a bag is added (reduced-motion safe via PetalRain).
export function AddToBagDelight() {
  const toast = useUIStore((s) => s.toast);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (toast?.kind !== "added-to-bag") return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[55]">
      <PetalRain burst count={14} />
    </div>
  );
}
