"use client";
import { useCallback, useRef, useState } from "react";

type WindowWithWebkit = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function useTvSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const enable = useCallback(() => {
    try {
      const w = window as WindowWithWebkit;
      const Ctx = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return;
      if (!ctxRef.current) ctxRef.current = new Ctx();
      void ctxRef.current.resume();
      setEnabled(true);
    } catch {
      /* audio unavailable — board still works silently */
    }
  }, []);

  const chime = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [880, 1108.73]; // A5, C#6 — gentle two-tone bell
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }, []);

  return { enabled, enable, chime };
}
