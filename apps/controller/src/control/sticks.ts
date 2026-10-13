import type { DriveInput } from "../shared";

/** A stick deflection in screen terms: x right, y down, each in [-1, 1] and inside the unit circle. */
export interface Stick {
  x: number;
  y: number;
}

export const CENTERED: Stick = { x: 0, y: 0 };

/** Converts a finger offset from the stick centre to a deflection, clamped to the rim so far drags read as full. */
export function offsetToStick(dx: number, dy: number, radius: number): Stick {
  if (radius <= 0) return CENTERED;
  const x = dx / radius;
  const y = dy / radius;
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/** What the stick's horizontal axis does; vertical is always forward/back. */
export type Horizontal = "strafe" | "turn";

/** Up is forward; sideways feeds strafe or turn, so resolveMotion still picks the one motion to send. */
export function stickToInput(stick: Stick, horizontal: Horizontal): DriveInput {
  const y = 0 - stick.y;
  return horizontal === "strafe" ? { x: stick.x, y, turn: 0 } : { x: 0, y, turn: stick.x };
}
