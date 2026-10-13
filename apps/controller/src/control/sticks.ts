import type { DriveInput } from "@acemate/core";

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

/** Drive input in switch terms, each in [-1, 1]: side follows the Strafe/Turn switch and other is the mode it is not on. */
export interface DriveAxes {
  forward: number;
  side: number;
  other: number;
}

export const IDLE: DriveAxes = { forward: 0, side: 0, other: 0 };

/** Feeds side and other to strafe or turn, so resolveMotion still picks the one motion to send. */
export function axesToInput({ forward, side, other }: DriveAxes, horizontal: Horizontal): DriveInput {
  return horizontal === "strafe" ? { x: side, y: forward, turn: other } : { x: other, y: forward, turn: side };
}

/** Up is forward; sideways follows the switch. */
export function stickToAxes(stick: Stick): DriveAxes {
  return { forward: 0 - stick.y, side: stick.x, other: 0 };
}

export function stickToInput(stick: Stick, horizontal: Horizontal): DriveInput {
  return axesToInput(stickToAxes(stick), horizontal);
}
