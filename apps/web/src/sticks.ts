// Same stick model as the Expo app (feat/expo-app apps/controller/src/control/sticks.ts), plus pointer ownership for multi-touch.
import type { DriveInput } from "../../../tools/web-drive/src/motion.js";

/** A stick deflection in screen terms: x right, y down, each in [-1, 1] and inside the unit circle. */
export interface Stick {
  x: number;
  y: number;
}

export type Side = "left" | "right";

export const CENTERED: Stick = { x: 0, y: 0 };

// Swallows finger jitter at rest; resolveMotion's own 0.25 deadzone still decides what counts as a push.
export const STICK_DEADZONE = 0.1;

/** Finger offset from the stick centre to a deflection, clamped to the rim so far drags read as full. */
export function offsetToStick(dx: number, dy: number, radius: number, deadzone = STICK_DEADZONE): Stick {
  if (radius <= 0) return CENTERED;
  const x = dx / radius;
  const y = dy / radius;
  const length = Math.hypot(x, y);
  if (length <= deadzone) return CENTERED;
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/** Left stick translates (up is forward); right stick turns with its horizontal axis only. */
export function sticksToInput(left: Stick, right: Stick): DriveInput {
  return { x: left.x, y: 0 - left.y, turn: right.x };
}

interface Slot {
  pointerId: number | null;
  stick: Stick;
}

/**
 * Two sticks, each owned by at most one pointer, so two thumbs work at once and a third finger is ignored.
 * Offsets are relative to the stick's centre, in CSS pixels.
 */
export class StickPair {
  private readonly slots: Record<Side, Slot> = { left: emptySlot(), right: emptySlot() };

  constructor(private readonly radius: () => number) {}

  /** Returns false when that stick is already held by another pointer. */
  down(side: Side, pointerId: number, dx: number, dy: number): boolean {
    const slot = this.slots[side];
    if (slot.pointerId !== null && slot.pointerId !== pointerId) return false;
    slot.pointerId = pointerId;
    this.place(side, dx, dy);
    return true;
  }

  move(pointerId: number, dx: number, dy: number): Side | null {
    const side = this.sideOf(pointerId);
    if (side) this.place(side, dx, dy);
    return side;
  }

  up(pointerId: number): Side | null {
    const side = this.sideOf(pointerId);
    if (side) this.slots[side] = emptySlot();
    return side;
  }

  releaseAll(): void {
    this.slots.left = emptySlot();
    this.slots.right = emptySlot();
  }

  stick(side: Side): Stick {
    return this.slots[side].stick;
  }

  input(): DriveInput {
    return sticksToInput(this.slots.left.stick, this.slots.right.stick);
  }

  private sideOf(pointerId: number): Side | null {
    if (this.slots.left.pointerId === pointerId) return "left";
    if (this.slots.right.pointerId === pointerId) return "right";
    return null;
  }

  private place(side: Side, dx: number, dy: number): void {
    this.slots[side].stick = offsetToStick(dx, side === "right" ? 0 : dy, this.radius());
  }
}

const emptySlot = (): Slot => ({ pointerId: null, stick: CENTERED });
