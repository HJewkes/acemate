import { IDLE, type DriveAxes } from "./sticks";

/** Aim steps: right moves the crosshair right on the pad, up raises the elevation. */
export interface AimStep {
  right: number;
  up: number;
}

/** Where key and gamepad input lands; WebInput routes DOM events and gamepad polls to it. */
export interface InputTarget {
  drive(source: "keys" | "pad", axes: DriveAxes): void;
  nudgeAim(step: AimStep): void;
  firePress(): void;
  fireRelease(): void;
  /** Escape or the pad's B: e-stop the drive and stop any run. */
  stop(): void;
}

// KeyboardEvent.code values, so the layout (AZERTY, Dvorak) doesn't move the keys.
const DRIVE_KEYS: Record<string, Partial<DriveAxes>> = {
  KeyW: { forward: 1 },
  KeyS: { forward: -1 },
  KeyA: { side: -1 },
  KeyD: { side: 1 },
  KeyQ: { other: -1 },
  KeyE: { other: 1 },
};

const AIM_KEYS: Record<string, AimStep> = {
  ArrowLeft: { right: -1, up: 0 },
  ArrowRight: { right: 1, up: 0 },
  ArrowUp: { right: 0, up: 1 },
  ArrowDown: { right: 0, up: -1 },
};

export const FIRE_KEY = "Space";
export const STOP_KEY = "Escape";

/** What the keys do, for the on-screen help. */
export const KEY_HELP: readonly { keys: string; action: string }[] = [
  { keys: "W S", action: "Forward, back" },
  { keys: "A D", action: "Left, right (follows the switch)" },
  { keys: "Q E", action: "Left, right (the other mode)" },
  { keys: "← →", action: "Aim direction" },
  { keys: "↑ ↓", action: "Aim elevation" },
  { keys: "Space", action: "Hold to fire" },
  { keys: "Esc", action: "Stop" },
];

/** Opposing keys (W+S) cancel to zero on that axis. */
export function keysToAxes(held: ReadonlySet<string>): DriveAxes {
  const sum = { ...IDLE };
  for (const code of held) {
    const axes = DRIVE_KEYS[code] ?? {};
    sum.forward += axes.forward ?? 0;
    sum.side += axes.side ?? 0;
    sum.other += axes.other ?? 0;
  }
  return sum;
}

/**
 * Turns key-down and key-up events into drive, aim, fire and stop. Auto-repeat only steps the aim:
 * it never restarts a fire hold, and a drive key needs a fresh press after the held set was released.
 */
export class KeyboardInput {
  private held = new Set<string>();

  constructor(private readonly target: InputTarget) {}

  /** Returns true when the key is one of ours, so the caller can stop the browser acting on it. */
  down(code: string, repeat: boolean): boolean {
    const step = AIM_KEYS[code];
    if (step) this.target.nudgeAim(step);
    else if (code === STOP_KEY) {
      if (!repeat) this.target.stop();
    } else if (code === FIRE_KEY || code in DRIVE_KEYS) {
      if (!repeat && !this.held.has(code)) this.press(code);
    } else return false;
    return true;
  }

  up(code: string): boolean {
    if (!this.held.delete(code)) return code in AIM_KEYS || code === STOP_KEY;
    if (code === FIRE_KEY) this.target.fireRelease();
    else this.target.drive("keys", keysToAxes(this.held));
    return true;
  }

  /** Lets go of every held key, as if each were released. */
  releaseAll(): void {
    const wasFiring = this.held.has(FIRE_KEY);
    this.held.clear();
    this.target.drive("keys", IDLE);
    if (wasFiring) this.target.fireRelease();
  }

  private press(code: string): void {
    this.held.add(code);
    if (code === FIRE_KEY) this.target.firePress();
    else this.target.drive("keys", keysToAxes(this.held));
  }
}
