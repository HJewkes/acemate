import { describe, expect, it } from "vitest";
import { Controller } from "../src/control/controller";
import type { PadSnapshot } from "../src/control/gamepad";
import { WebInput, createInputActions } from "../src/control/web-input";
import { flush, harness } from "./harness";

const PAD_FORWARD: PadSnapshot = { axes: [0, -1, 0, 0], buttons: [] };

// WebInput over a real Controller and RobotSession on the fake link, with the fire hold recorded.
function page() {
  const robot = harness();
  const controller = new Controller();
  const hold: string[] = [];
  const input = new WebInput(
    createInputActions({
      controller,
      hold: { press: () => hold.push("press"), release: () => hold.push("release"), cancel: () => hold.push("cancel") },
      fireLocked: () => false,
      updateAim: () => undefined,
      flipDirection: false,
      stopRobot: () => robot.session.emergencyStop(),
    }),
  );
  return { robot, controller, hold, input };
}

describe("web input stops", () => {
  it("sends stop then run_stop on Escape and latches a held key", async () => {
    const { robot, controller, hold, input } = page();
    input.keyDown("KeyW", false);
    await robot.drive(controller.read().motion);

    input.keyDown("Escape", false);
    await flush();

    expect(robot.timeline.slice(-2)).toEqual(["motion:stop", "run_stop"]);
    expect(controller.read()).toEqual({ motion: "stop", latched: true });
    expect(hold).toContain("cancel");
  });

  it("releases keys, pad and the fire hold on blur, and latches the touch stick", () => {
    const { controller, hold, input } = page();
    controller.setStick({ x: 0, y: -1 });
    input.keyDown("KeyW", false);
    input.keyDown("Space", false);
    input.poll(PAD_FORWARD, 50);

    input.leave("blur");

    expect(hold.slice(-2)).toEqual(["release", "cancel"]);
    expect(controller.read()).toEqual({ motion: "stop", latched: true });
    controller.setStick({ x: 0, y: 0 });
    expect(controller.read()).toEqual({ motion: "stop", latched: false });
  });

  it("keeps the run going on blur but stops it when the page is hidden", async () => {
    const blurred = page();
    const hidden = page();

    blurred.input.leave("blur");
    hidden.input.leave("hidden");
    await flush();

    expect(blurred.robot.types()).not.toContain("run_stop");
    expect(hidden.robot.types()).toContain("run_stop");
  });
});

describe("web input while the device menu is open", () => {
  it("neither drives nor fires, and lets go of what was held", () => {
    const { controller, hold, input } = page();
    input.keyDown("KeyW", false);

    input.setEnabled(false);
    input.keyDown("KeyD", false);
    input.keyDown("Space", false);
    input.poll(PAD_FORWARD, 50);

    expect(controller.read().motion).toBe("stop");
    expect(hold).toEqual([]);
  });
});
