import { describe, expect, it } from "vitest";
import { createHoldFire, HOLD_MS } from "@acemate/core";
import { Controller } from "../src/control/controller";
import {
  BOUND_KEYS,
  HELPED_KEYS,
  KEY_HELP,
  KeyboardInput,
  type AimStep,
  type InputTarget,
} from "../src/control/keyboard";
import type { Horizontal } from "../src/control/sticks";
import { createInputActions, nudgeAim } from "../src/control/web-input";

// Routes keys into a real Controller, so the tests read the motion the robot would get.
function drivenBy(horizontal: Horizontal) {
  const controller = new Controller();
  controller.setHorizontal(horizontal);
  const target: InputTarget = {
    drive: (source, axes) => controller.setSource(source, axes),
    nudgeAim: () => undefined,
    firePress: () => undefined,
    fireRelease: () => undefined,
    stop: () => controller.emergencyStop(),
  };
  const keys = new KeyboardInput(target);
  const motionWhileHeld = (code: string) => {
    keys.down(code, false);
    const motion = controller.read().motion;
    keys.up(code);
    return motion;
  };
  return { keys, controller, motionWhileHeld };
}

describe("keyboard driving", () => {
  it("drives forward and back on W and S in either mode", () => {
    const { motionWhileHeld } = drivenBy("turn");

    expect([motionWhileHeld("KeyW"), motionWhileHeld("KeyS")]).toEqual(["go_front", "go_back"]);
  });

  it("strafes on A and D and turns on Q and E while the switch says Strafe", () => {
    const { motionWhileHeld } = drivenBy("strafe");

    const motions = ["KeyA", "KeyD", "KeyQ", "KeyE"].map(motionWhileHeld);

    expect(motions).toEqual(["go_left", "go_right", "turn_left", "turn_right"]);
  });

  it("turns on A and D and strafes on Q and E while the switch says Turn", () => {
    const { motionWhileHeld } = drivenBy("turn");

    const motions = ["KeyA", "KeyD", "KeyQ", "KeyE"].map(motionWhileHeld);

    expect(motions).toEqual(["turn_left", "turn_right", "go_left", "go_right"]);
  });

  it("stops when the key comes up", () => {
    const { keys, controller } = drivenBy("strafe");
    keys.down("KeyW", false);
    controller.read();

    keys.up("KeyW");

    expect(controller.read().motion).toBe("stop");
  });

  it("does not let auto-repeat bring back a key dropped by a release", () => {
    const { keys, controller } = drivenBy("strafe");
    keys.down("KeyW", false);
    keys.releaseAll();

    keys.down("KeyW", true);

    expect(controller.read().motion).toBe("stop");
  });

  it("claims its own keys and leaves the rest to the browser", () => {
    const { keys } = drivenBy("strafe");

    expect(["KeyW", "Space", "Escape", "ArrowUp", "Tab", "KeyT"].map((code) => keys.down(code, false))).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("arrow keys aim", () => {
  function aimedBy(presses: [code: string, repeat: boolean][], start = { direction: 0, elevation: 20 }) {
    let aim = start;
    const target: InputTarget = {
      drive: () => undefined,
      nudgeAim: (step: AimStep) => (aim = nudgeAim(aim, step, false)),
      firePress: () => undefined,
      fireRelease: () => undefined,
      stop: () => undefined,
    };
    const keys = new KeyboardInput(target);
    presses.forEach(([code, repeat]) => keys.down(code, repeat));
    return aim;
  }

  it("steps direction on left and right and elevation on up and down, one step per press", () => {
    const aim = aimedBy([
      ["ArrowRight", false],
      ["ArrowRight", false],
      ["ArrowUp", false],
      ["ArrowLeft", false],
      ["ArrowLeft", false],
      ["ArrowLeft", false],
      ["ArrowDown", false],
      ["ArrowDown", false],
    ]);

    expect(aim).toEqual({ direction: -1, elevation: 19 });
  });

  it("keeps stepping on auto-repeat while held", () => {
    const aim = aimedBy([
      ["ArrowUp", false],
      ["ArrowUp", true],
      ["ArrowUp", true],
    ]);

    expect(aim.elevation).toBe(23);
  });

  it("clamps at the ends of the ranges", () => {
    const aim = aimedBy(
      [
        ["ArrowRight", false],
        ["ArrowUp", false],
      ],
      { direction: 15, elevation: 40 },
    );

    expect(aim).toEqual({ direction: 15, elevation: 40 });
  });

  it("moves the crosshair the way the arrow points when the direction is flipped", () => {
    expect(nudgeAim({ direction: 0, elevation: 20 }, { right: 1, up: 0 }, true).direction).toBe(-1);
  });
});

describe("space holds to fire", () => {
  // The app's 600 ms hold machine on a fake clock, behind the real key and action routing.
  function spaceFire(locked = false) {
    let now = 0;
    let fired = 0;
    let presses = 0;
    const machine = createHoldFire(HOLD_MS);
    const fire = (reading: { fire: boolean }) => {
      if (reading.fire) fired++;
    };
    const hold = {
      press: () => {
        presses++;
        fire(machine.press(now));
      },
      release: () => fire(machine.release()),
      cancel: () => fire(machine.cancel()),
    };
    const actions = createInputActions({
      controller: new Controller(),
      hold,
      fireLocked: () => locked,
      updateAim: () => undefined,
      flipDirection: false,
      stopRobot: () => undefined,
      closeLink: () => undefined,
    });
    const keys = new KeyboardInput(actions);
    const wait = (ms: number) => {
      now += ms;
      fire(machine.tick(now));
    };
    return { keys, wait, fired: () => fired, presses: () => presses };
  }

  it("fires once after the hold, however long Space stays down", () => {
    const { keys, wait, fired } = spaceFire();
    keys.down("Space", false);

    wait(HOLD_MS);
    wait(HOLD_MS);

    expect(fired()).toBe(1);
  });

  it("cancels when Space comes up before the hold completes", () => {
    const { keys, wait, fired } = spaceFire();
    keys.down("Space", false);
    wait(HOLD_MS - 100);

    keys.up("Space");
    wait(HOLD_MS);

    expect(fired()).toBe(0);
  });

  it("ignores auto-repeat, so the hold is pressed once and fires on time, once", () => {
    const { keys, wait, fired, presses } = spaceFire();
    keys.down("Space", false);
    wait(HOLD_MS - 100);

    keys.down("Space", true);
    wait(100);
    const firedOnTime = fired();
    keys.down("Space", true);
    wait(HOLD_MS);

    expect([presses(), firedOnTime, fired()]).toEqual([1, 1, 1]);
  });

  it("needs a fresh press to fire again", () => {
    const { keys, wait, fired } = spaceFire();
    keys.down("Space", false);
    wait(HOLD_MS);
    keys.up("Space");

    keys.down("Space", false);
    wait(HOLD_MS);

    expect(fired()).toBe(2);
  });

  it("does not start a hold while fire is locked", () => {
    const { keys, wait, fired } = spaceFire(true);

    keys.down("Space", false);
    wait(HOLD_MS);

    expect(fired()).toBe(0);
  });
});

describe("keyboard help", () => {
  it("covers every bound key exactly once and no unbound key", () => {
    expect([...HELPED_KEYS].sort()).toEqual([...BOUND_KEYS].sort());
  });

  it("lists only keys the keyboard actually handles", () => {
    const { keys } = drivenBy("strafe");

    expect(BOUND_KEYS.filter((code) => !keys.down(code, false))).toEqual([]);
  });

  it("prints key names rather than event codes", () => {
    expect(KEY_HELP.map((row) => row.keys)).toEqual(["W S", "A D", "Q E", "← →", "↑ ↓", "Space", "Esc"]);
  });
});
