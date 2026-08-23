// components/motion/useDragSpring.ts
"use client";
import { useRef, useEffect } from "react";
import { useMotionValue, animate, useReducedMotion } from "framer-motion";
import { SPRING, projectSnap, rubberband } from "@/lib/motion";

type Opts = {
  axis?: "x" | "y";
  snapPoints: number[];
  onSettle?: (point: number) => void;
};

// Direct manipulation with velocity handoff + momentum projection (Apple §2,5,6,9).
export function useDragSpring({ axis = "y", snapPoints, onSettle }: Opts) {
  const value = useMotionValue(snapPoints[0] ?? 0);
  const reduce = useReducedMotion();
  const min = Math.min(...snapPoints);
  const max = Math.max(...snapPoints);
  const dim = (max - min) || 1;
  // velocity/position history for release velocity
  const hist = useRef<{ p: number; t: number }[]>([]);
  const grabOffset = useRef(0);
  // Live window listeners for the in-progress drag, if any — lets unmount
  // clean up when onUp never fires (component unmounted mid-drag).
  const active = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null);

  function point(e: PointerEvent | React.PointerEvent) {
    return axis === "y" ? e.clientY : e.clientX;
  }

  function animateTo(target: number) {
    if (reduce) { value.set(target); onSettle?.(target); return; }
    animate(value, target, { ...SPRING.drawer, onComplete: () => onSettle?.(target) });
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    value.stop(); // interruptible: grab a moving element mid-flight
    grabOffset.current = point(e) - value.get();
    hist.current = [{ p: point(e), t: e.timeStamp }];

    const onMove = (ev: PointerEvent) => {
      let next = point(ev) - grabOffset.current;
      if (next < min) next = min + rubberband(next - min, dim);
      else if (next > max) next = max + rubberband(next - max, dim);
      value.set(next);
      hist.current.push({ p: point(ev), t: ev.timeStamp });
      if (hist.current.length > 5) hist.current.shift();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      active.current = null;
      const h = hist.current;
      const first = h[0], last = h[h.length - 1];
      const dt = Math.max(1, last.t - first.t);
      const velocity = ((last.p - first.p) / dt) * 1000; // px/s
      const target = projectSnap(value.get(), velocity, snapPoints);
      if (reduce) { value.set(target); onSettle?.(target); return; }
      animate(value, target, { ...SPRING.momentum, velocity, onComplete: () => onSettle?.(target) });
    };
    active.current = { move: onMove, up: onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // If the component unmounts mid-drag, onUp never fires and the window
  // listeners (plus their stale closures over value/hist) would otherwise leak.
  useEffect(() => () => {
    if (active.current) {
      window.removeEventListener("pointermove", active.current.move);
      window.removeEventListener("pointerup", active.current.up);
    }
  }, []);

  return { value, bind: { onPointerDown }, animateTo };
}
