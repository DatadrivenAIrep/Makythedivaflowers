// Motion-system tokens + pure physics helpers, translated from Apple's
// "Designing Fluid Interfaces" (WWDC 2018). See
// docs/superpowers/specs/2026-08-22-apple-fluid-redesign-design.md.
import type { Transition } from "framer-motion";

/**
 * Springs in Apple's two-parameter model, via Framer Motion's bounce +
 * duration (which maps closely to Apple's damping + response). Default is
 * critically damped (no overshoot); momentum/drawer add bounce only because
 * a gesture with momentum precedes them.
 */
export const SPRING = {
  default: { type: "spring", bounce: 0, duration: 0.4 },
  snappy: { type: "spring", bounce: 0, duration: 0.3 },
  momentum: { type: "spring", bounce: 0.2, duration: 0.4 },
  drawer: { type: "spring", bounce: 0.2, duration: 0.3 },
} as const satisfies Record<string, Transition>;

/**
 * Projected travel distance (px) of a flick, using exponential decay — the
 * scroll-deceleration model, NOT the v²/2a textbook form.
 * @param velocity px/s at release
 * @param decelerationRate 0.998 ≈ normal feel; 0.99 = snappier
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Snap point nearest the PROJECTED endpoint (throw to where the gesture is going). */
export function projectSnap(
  current: number,
  velocity: number,
  snapPoints: readonly number[],
  decelerationRate = 0.998,
): number {
  const endpoint = current + project(velocity, decelerationRate);
  return snapPoints.reduce((best, p) =>
    Math.abs(p - endpoint) < Math.abs(best - endpoint) ? p : best,
  );
}

/** Absolute px/s velocity -> relative velocity (per remaining distance); guards /0. */
export function normalizeVelocity(gestureVelocity: number, target: number, current: number): number {
  const distance = target - current;
  return distance === 0 ? 0 : gestureVelocity / distance;
}

/** Progressive resistance past a boundary (real things slow before they stop). */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
