// components/cart/AddToBagDelight.tsx
"use client";
import { useEffect, useState } from "react";
import { useUIStore } from "@/lib/ui-store";
import { PetalRain } from "@/components/home/PetalRain";

// One-shot petal burst when a bag is added (reduced-motion safe via PetalRain).
export function AddToBagDelight() {
  const toast = useUIStore((s) => s.toast);
  const [show, setShow] = useState(false);
  // Bumped on every "added-to-bag" toast so <PetalRain key={nonce}> remounts
  // and replays its one-shot burst even when re-added within the same window
  // (setShow(true) alone is a no-op once already showing).
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (toast?.kind !== "added-to-bag") return;
    setShow(true);
    setNonce((n) => n + 1);
    // Burst petals run 2.4-3.6s (buildPetals: burstDuration = 2.4 + r*1.2)
    // plus up to a 0.4s stagger delay (burstDelay = r*0.4) -> worst case 4s.
    // Hide only after the slowest petal has finished, so teardown never cuts
    // the animation mid-fall.
    const id = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[55]">
      <PetalRain key={nonce} burst count={14} />
    </div>
  );
}
