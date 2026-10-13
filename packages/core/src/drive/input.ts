import { NEUTRAL, type DriveInput, type Motion } from "./motion";

// KeyboardEvent.code values, so the layout (AZERTY, Dvorak) doesn't move the keys.
const KEY_AXES: Record<string, Partial<DriveInput>> = {
  KeyW: { y: 1 },
  ArrowUp: { y: 1 },
  KeyS: { y: -1 },
  ArrowDown: { y: -1 },
  KeyQ: { x: -1 },
  KeyE: { x: 1 },
  KeyA: { turn: -1 },
  ArrowLeft: { turn: -1 },
  KeyD: { turn: 1 },
  ArrowRight: { turn: 1 },
};

export const STOP_KEY = "Space";

export function isDriveKey(code: string): boolean {
  return code in KEY_AXES;
}

export function pressKey(held: ReadonlySet<string>, code: string): Set<string> {
  return isDriveKey(code) ? new Set(held).add(code) : new Set(held);
}

export function releaseKey(held: ReadonlySet<string>, code: string): Set<string> {
  const next = new Set(held);
  next.delete(code);
  return next;
}

/** Opposing keys (W+S) cancel to zero on that axis. */
export function keysToInput(held: ReadonlySet<string>): DriveInput {
  const sum = { ...NEUTRAL };
  for (const code of held) {
    const axes = KEY_AXES[code] ?? {};
    sum.x += axes.x ?? 0;
    sum.y += axes.y ?? 0;
    sum.turn += axes.turn ?? 0;
  }
  return { x: clamp(sum.x), y: clamp(sum.y), turn: clamp(sum.turn) };
}

/** Standard mapping: axes 0/1 left stick (up is -1), axis 2 right stick horizontal. */
export function gamepadToInput(axes: readonly number[]): DriveInput {
  return { x: axes[0] ?? 0, y: 0 - (axes[1] ?? 0), turn: axes[2] ?? 0 };
}

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/** After an emergency stop, stay stopped until every input returns to neutral, so a held key can't restart the robot. */
export function applyStopLatch(latched: boolean, motion: Motion): { latched: boolean; motion: Motion } {
  if (!latched) return { latched, motion };
  return motion === "stop" ? { latched: false, motion } : { latched: true, motion: "stop" };
}
