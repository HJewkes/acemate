import { SPANS, flipped, stepBy, type Aim } from "@acemate/core";
import type { Controller } from "./controller";
import { GamepadInput, type PadSnapshot } from "./gamepad";
import { KeyboardInput, type AimStep, type InputTarget } from "./keyboard";

/** The page lost focus (blur), was hidden (tab switch, phone locked) or is being unloaded. */
export type LeaveReason = "blur" | "hidden" | "pagehide";

export interface InputActions extends InputTarget {
  leave(reason: LeaveReason): void;
}

interface InputDeps {
  controller: Controller;
  hold: { press(): void; release(): void; cancel(): void };
  /** The same lock the fire bar shows; a locked press never starts a hold. */
  fireLocked(): boolean;
  updateAim(change: (aim: Aim) => Aim): void;
  flipDirection: boolean;
  /** Writes stop at once, then run_stop. */
  stopRobot(): void;
  /** Stops and drops the link, as native does on going to the background; reconnecting then needs a tap. */
  closeLink(): void;
}

/** Steps the aim on the pad's axes and clamps it to the ranges; right honours the direction flip like the pad does. */
export function nudgeAim(aim: Aim, step: AimStep, flipDirection: boolean): Aim {
  const right = stepBy(flipped(aim.direction, flipDirection), step.right, SPANS.direction);
  return {
    direction: flipped(right, flipDirection),
    elevation: stepBy(aim.elevation, step.up, SPANS.elevation),
  };
}

/** Binds key and pad input to the controller, the shared fire hold and the robot. */
export function createInputActions(deps: InputDeps): InputActions {
  const { controller, hold } = deps;
  const latch = () => {
    controller.emergencyStop();
    hold.cancel();
  };
  return {
    drive: (source, axes) => controller.setSource(source, axes),
    nudgeAim: (step) => deps.updateAim((aim) => nudgeAim(aim, step, deps.flipDirection)),
    firePress: () => {
      if (!deps.fireLocked()) hold.press();
    },
    fireRelease: () => hold.release(),
    stop: () => {
      latch();
      deps.stopRobot();
    },
    // Blur keeps the link and any run. Hidden and pagehide stop the run and drop the link, since the page may never
    // come back: a reload or a closed tab must not leave a run going.
    leave: (reason) => {
      latch();
      if (reason === "blur") return;
      deps.stopRobot();
      deps.closeLink();
    },
  };
}

/** Keyboard and gamepad together, off while the device menu is open, and released whenever the page is left. */
export class WebInput {
  private readonly keys: KeyboardInput;
  private readonly pad: GamepadInput;
  private enabled = true;

  constructor(private readonly actions: InputActions) {
    this.keys = new KeyboardInput(actions);
    this.pad = new GamepadInput(actions);
  }

  setEnabled(enabled: boolean): void {
    if (!enabled) this.release();
    this.enabled = enabled;
  }

  /** True when the key is ours, so the browser should not also act on it (scroll, press a focused button). */
  keyDown(code: string, repeat: boolean): boolean {
    return this.enabled && this.keys.down(code, repeat);
  }

  // Key-ups always land, so a key released while the menu was open is not left held.
  keyUp(code: string): boolean {
    return this.keys.up(code);
  }

  poll(pad: PadSnapshot | null, elapsedMs: number): void {
    if (this.enabled) this.pad.poll(pad, elapsedMs);
  }

  leave(reason: LeaveReason): void {
    this.release();
    this.actions.leave(reason);
  }

  private release(): void {
    this.keys.releaseAll();
    this.pad.releaseAll();
  }
}
