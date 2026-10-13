import { describe, expect, it } from "vitest";
import { Controller } from "../src/control/controller";
import { CENTERED, offsetToStick, stickToInput, type Horizontal, type Stick } from "../src/control/sticks";

describe("stick mapping", () => {
  it("scales a finger offset by the pad radius", () => {
    expect(offsetToStick(30, -60, 120)).toEqual({ x: 0.25, y: -0.5 });
  });

  it("clamps a drag past the rim to full deflection in the same direction", () => {
    const stick = offsetToStick(300, 400, 100);

    expect(stick.x).toBeCloseTo(0.6);
    expect(stick.y).toBeCloseTo(0.8);
  });

  it("maps up to forward and sideways to strafe in strafe mode", () => {
    expect(stickToInput({ x: -0.7, y: -0.4 }, "strafe")).toEqual({ x: -0.7, y: 0.4, turn: 0 });
  });

  it("maps sideways to turn in turn mode", () => {
    expect(stickToInput({ x: -0.7, y: -0.4 }, "turn")).toEqual({ x: 0, y: 0.4, turn: -0.7 });
  });
});

describe("controller", () => {
  const read = (stick: Stick, horizontal: Horizontal = "strafe") => {
    const controller = new Controller();
    controller.horizontal = horizontal;
    controller.setStick(stick);
    return controller.read().motion;
  };

  it("reads stop and ignores the stick while suspended by the device menu, then follows it again", () => {
    const controller = new Controller();
    controller.setStick({ x: 0, y: -1 });

    controller.suspend(true);
    const centred = controller.read().motion;
    controller.setStick({ x: 0, y: -1 });
    const ignored = controller.read().motion;
    controller.suspend(false);
    controller.setStick({ x: 0, y: -1 });

    expect([centred, ignored]).toEqual(["stop", "stop"]);
    expect(controller.read().motion).toBe("go_front");
  });

  it("ignores a nudge inside the 0.25 deadzone in either mode", () => {
    expect(read({ x: 0.2, y: -0.2 }, "strafe")).toBe("stop");
    expect(read({ x: 0.2, y: -0.2 }, "turn")).toBe("stop");
  });

  it("drives the dominant axis in strafe mode", () => {
    expect(read({ x: 0, y: -0.3 })).toBe("go_front");
    expect(read({ x: 0, y: 0.8 })).toBe("go_back");
    expect(read({ x: -0.6, y: 0.3 })).toBe("go_left");
    expect(read({ x: 0.6, y: -0.3 })).toBe("go_right");
  });

  it("turns instead of strafing in turn mode", () => {
    expect(read({ x: -0.6, y: 0 }, "turn")).toBe("turn_left");
    expect(read({ x: 0.6, y: 0 }, "turn")).toBe("turn_right");
  });

  it("lets a turn past 0.5 win over forward, and a gentle turn only when forward is in the deadzone", () => {
    expect(read({ x: 0.6, y: -0.8 }, "turn")).toBe("turn_right");
    expect(read({ x: 0.4, y: -0.9 }, "turn")).toBe("go_front");
    expect(read({ x: -0.4, y: 0 }, "turn")).toBe("turn_left");
  });

  it("holds stop after an emergency stop while the stick is still pushed", () => {
    const controller = new Controller();
    controller.setStick({ x: 0, y: -1 });
    controller.emergencyStop();

    expect(controller.read()).toEqual({ motion: "stop", latched: true });
    controller.setStick({ x: 1, y: 0 });
    expect(controller.read()).toEqual({ motion: "stop", latched: true });
  });

  it("rearms only after the stick returns to neutral", () => {
    const controller = new Controller();
    controller.setStick({ x: 0, y: -1 });
    controller.emergencyStop();
    controller.read();

    controller.setStick(CENTERED);
    expect(controller.read()).toEqual({ motion: "stop", latched: false });
    controller.setStick({ x: 0, y: -1 });
    expect(controller.read()).toEqual({ motion: "go_front", latched: false });
  });
});
