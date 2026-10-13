import { flipped } from "./assumptions.js";
import { SPANS, clamp, snapTo } from "./ranges.js";

export interface Aim {
  direction: number;
  elevation: number;
}

/** Fractions across the pad, 0..1 from the left and from the top. */
export interface PadPoint {
  fx: number;
  fy: number;
}

const { direction: DIR, elevation: ELEV } = SPANS;

/** Left to right sweeps the robot's left to its right; top is the steepest elevation. */
export function padToAim(point: PadPoint, flipDirection: boolean): Aim {
  const right = DIR.min + clamp(point.fx, 0, 1) * (DIR.max - DIR.min);
  const elevation = ELEV.max - clamp(point.fy, 0, 1) * (ELEV.max - ELEV.min);
  return { direction: snapTo(flipped(right, flipDirection), DIR), elevation: snapTo(elevation, ELEV) };
}

export function aimToPad(aim: Aim, flipDirection: boolean): PadPoint {
  const right = flipped(aim.direction, flipDirection);
  return { fx: (right - DIR.min) / (DIR.max - DIR.min), fy: (ELEV.max - aim.elevation) / (ELEV.max - ELEV.min) };
}

export function pixelToAim(
  px: number,
  py: number,
  size: { width: number; height: number },
  flipDirection: boolean,
): Aim {
  return padToAim({ fx: px / size.width, fy: py / size.height }, flipDirection);
}

/** "R 7°", "L 3°" or "centre", from the robot's point of view. */
export function directionLabel(direction: number, flipDirection: boolean): string {
  const right = flipped(direction, flipDirection);
  if (right === 0) return "centre";
  return `${right > 0 ? "R" : "L"} ${Math.abs(right)}°`;
}
