import { MAX_TOTAL_BALLS, S10_LIMITS } from "../protocol/launch";

export interface Span {
  min: number;
  max: number;
  step: number;
}

// The UI's steps; launch.ts still validates every value before anything is sent.
export const SPANS = {
  direction: { min: S10_LIMITS.direction.min, max: S10_LIMITS.direction.max, step: 1 },
  speed: { min: S10_LIMITS.speed.min, max: S10_LIMITS.speed.max, step: 1 },
  spin: { min: S10_LIMITS.spin.min, max: S10_LIMITS.spin.max, step: 1 },
  elevation: { min: S10_LIMITS.elevation.min, max: S10_LIMITS.elevation.max, step: 1 },
  count: { min: 1, max: MAX_TOTAL_BALLS, step: 1 },
  interval: { min: S10_LIMITS.interval.min, max: S10_LIMITS.interval.max, step: 0.5 },
  heightLevel: { min: S10_LIMITS.heightLevel.min, max: S10_LIMITS.heightLevel.max, step: 1 },
  targetX: { min: S10_LIMITS.targetX.min, max: S10_LIMITS.targetX.max, step: 0.1 },
  targetZ: { min: S10_LIMITS.targetZ.min, max: S10_LIMITS.targetZ.max, step: 0.1 },
} satisfies Record<string, Span>;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Rounds through the step's decimal places so 0.1 steps give 2.3, not 2.3000000000000003.
function roundToStep(value: number, step: number): number {
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Number((Math.round(value / step) * step).toFixed(decimals)) || 0;
}

/** Snaps to the span's step, then clamps into the span without leaving the step grid. */
export function snapTo(value: number, span: Span): number {
  const snapped = roundToStep(value, span.step);
  if (snapped > span.max) return roundToStep(Math.floor(span.max / span.step) * span.step, span.step);
  if (snapped < span.min) return roundToStep(Math.ceil(span.min / span.step) * span.step, span.step);
  return snapped;
}

export function stepBy(value: number, steps: number, span: Span): number {
  return snapTo(value + steps * span.step, span);
}
