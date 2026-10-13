import type { AimStep, InputTarget } from "./keyboard";
import { IDLE, type DriveAxes } from "./sticks";

/** The parts of a browser Gamepad we read, so tests can pass plain objects. */
export interface PadSnapshot {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

/** Sticks drift a little at rest; inside this radius they read centred. */
export const PAD_DEADZONE = 0.2;
/** Full right-stick deflection moves the aim this many steps a second. */
export const AIM_STEPS_PER_SECOND = 15;

// Standard mapping: axes 0/1 left stick, 2/3 right stick (up is -1); button 1 is B / circle, 7 the right trigger.
const STOP_BUTTON = 1;
const FIRE_BUTTON = 7;
const TRIGGER_PRESSED = 0.5;

/** A radial deadzone, rescaled so the stick still reaches full deflection at the rim. */
export function applyDeadzone(x: number, y: number, deadzone: number = PAD_DEADZONE): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const scale = Math.min(1, (length - deadzone) / (1 - deadzone)) / length;
  return { x: x * scale, y: y * scale };
}

/** The left stick drives like the touch stick: up is forward and sideways follows the switch. */
export function padDrive(pad: PadSnapshot): DriveAxes {
  const { x, y } = applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
  return { forward: 0 - y, side: x, other: 0 };
}

/** The right stick moves the aim, in steps per second. */
export function padAimRate(pad: PadSnapshot): AimStep {
  const { x, y } = applyDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
  return { right: x * AIM_STEPS_PER_SECOND, up: (0 - y) * AIM_STEPS_PER_SECOND };
}

function isPressed(pad: PadSnapshot, index: number): boolean {
  const button = pad.buttons[index];
  return button !== undefined && (button.pressed || button.value > TRIGGER_PRESSED);
}

interface Buttons {
  fire: boolean;
  stop: boolean;
}

/** Polls one gamepad into drive, aim, fire and stop. Buttons act on edges, so a held trigger fires once. */
export class GamepadInput {
  // Null until the first poll after a release, which is taken as a baseline: a trigger already down does not fire.
  private last: Buttons | null = null;
  private carry: AimStep = { right: 0, up: 0 };

  constructor(private readonly target: InputTarget) {}

  poll(pad: PadSnapshot | null, elapsedMs: number): void {
    if (!pad) {
      if (this.last) this.releaseAll();
      return;
    }
    this.target.drive("pad", padDrive(pad));
    this.aim(padAimRate(pad), elapsedMs);
    const now = { fire: isPressed(pad, FIRE_BUTTON), stop: isPressed(pad, STOP_BUTTON) };
    if (this.last) this.edges(this.last, now);
    this.last = now;
  }

  releaseAll(): void {
    if (this.last?.fire) this.target.fireRelease();
    this.last = null;
    this.carry = { right: 0, up: 0 };
    this.target.drive("pad", IDLE);
  }

  private edges(before: Buttons, now: Buttons): void {
    if (now.stop && !before.stop) this.target.stop();
    if (now.fire && !before.fire) this.target.firePress();
    if (!now.fire && before.fire) this.target.fireRelease();
  }

  // Whole steps go out as they accrue; a stick back in the deadzone drops the leftover fraction.
  private aim(rate: AimStep, elapsedMs: number): void {
    const accrue = (carry: number, perSecond: number) => (perSecond === 0 ? 0 : carry + (perSecond * elapsedMs) / 1000);
    const right = accrue(this.carry.right, rate.right);
    const up = accrue(this.carry.up, rate.up);
    const step = { right: Math.trunc(right), up: Math.trunc(up) };
    this.carry = { right: right - step.right, up: up - step.up };
    if (step.right !== 0 || step.up !== 0) this.target.nudgeAim(step);
  }
}

/** What the gamepad does, for the on-screen help. */
export const PAD_HELP: readonly { keys: string; action: string }[] = [
  { keys: "Left stick", action: "Drive (sideways follows the switch)" },
  { keys: "Right stick", action: "Aim" },
  { keys: "Right trigger", action: "Hold to fire" },
  { keys: "B / ○", action: "Stop" },
];
