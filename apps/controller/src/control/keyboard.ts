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

const FIRE_KEY = "Space";
const STOP_KEY = "Escape";

/** Every KeyboardEvent.code this module acts on. */
export const BOUND_KEYS: readonly string[] = [...Object.keys(DRIVE_KEYS), ...Object.keys(AIM_KEYS), FIRE_KEY, STOP_KEY];

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "Esc",
};

/** The printed name of a KeyboardEvent.code: KeyW is "W", ArrowLeft is "←". */
function keyName(code: string): string {
  return KEY_NAMES[code] ?? code.replace(/^Key/, "");
}

export interface HelpRow {
  keys: string;
  action: string;
}

const KEY_ACTIONS: readonly { codes: readonly string[]; action: string }[] = [
  { codes: ["KeyW", "KeyS"], action: "Forward, back" },
  { codes: ["KeyA", "KeyD"], action: "Left, right (follows the switch)" },
  { codes: ["KeyQ", "KeyE"], action: "Left, right (the other mode)" },
  { codes: ["ArrowLeft", "ArrowRight"], action: "Aim direction" },
  { codes: ["ArrowUp", "ArrowDown"], action: "Aim elevation" },
  { codes: [FIRE_KEY], action: "Hold to fire" },
  { codes: [STOP_KEY], action: "Stop" },
];

/** The codes the on-screen help covers; a test holds this equal to BOUND_KEYS so the help cannot drift. */
export const HELPED_KEYS: readonly string[] = KEY_ACTIONS.flatMap(({ codes }) => codes);

/** What the keys do, for the on-screen help, with key names derived from the bound codes. */
export const KEY_HELP: readonly HelpRow[] = KEY_ACTIONS.map(({ codes, action }) => ({
  keys: codes.map(keyName).join(" "),
  action,
}));

/** Opposing keys (W+S) cancel to zero on that axis. */
function keysToAxes(held: ReadonlySet<string>): DriveAxes {
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
