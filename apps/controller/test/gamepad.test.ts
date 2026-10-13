import { describe, expect, it } from "vitest";
import {
  AIM_STEPS_PER_SECOND,
  GamepadInput,
  PAD_DEADZONE,
  applyDeadzone,
  padDrive,
  type PadSnapshot,
} from "../src/control/gamepad";
import type { AimStep, InputTarget } from "../src/control/keyboard";
import type { DriveAxes } from "../src/control/sticks";

function pad({ axes = [0, 0, 0, 0], fire = false, stop = false } = {}): PadSnapshot {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  buttons[1] = { pressed: stop, value: stop ? 1 : 0 };
  buttons[7] = { pressed: false, value: fire ? 1 : 0 };
  return { axes, buttons };
}

function recorded() {
  const calls: string[] = [];
  const steps: AimStep[] = [];
  let drive: DriveAxes = { forward: 0, side: 0, other: 0 };
  const target: InputTarget = {
    drive: (_source, axes) => (drive = axes),
    nudgeAim: (step) => steps.push(step),
    firePress: () => calls.push("press"),
    fireRelease: () => calls.push("release"),
    stop: () => calls.push("stop"),
  };
  return { input: new GamepadInput(target), calls, steps, drive: () => drive };
}

describe("gamepad deadzone", () => {
  it("reads a resting drift inside the deadzone as centred", () => {
    expect(applyDeadzone(0.12, -0.15)).toEqual({ x: 0, y: 0 });
  });

  it("rescales past the deadzone so the rim still reads full", () => {
    expect(applyDeadzone(1, 0).x).toBeCloseTo(1);
    expect(applyDeadzone(PAD_DEADZONE + (1 - PAD_DEADZONE) / 2, 0).x).toBeCloseTo(0.5);
  });
});

describe("gamepad mapping", () => {
  it("drives with the left stick: up is forward and sideways follows the switch", () => {
    const axes = padDrive(pad({ axes: [0.6, -0.8, 0, 0] }));

    expect(axes.forward).toBeCloseTo(0.8);
    expect(axes.side).toBeCloseTo(0.6);
    expect(axes.other).toBe(0);
  });

  it("moves the aim with the right stick at a rate, in whole steps", () => {
    const { input, steps } = recorded();
    const total = () => steps.reduce((sum, step) => ({ right: sum.right + step.right, up: sum.up + step.up }));

    for (let i = 0; i < 20; i++) input.poll(pad({ axes: [0, 0, 1, 0] }), 50);
    for (let i = 0; i < 20; i++) input.poll(pad({ axes: [0, 0, 0, -1] }), 50);

    expect(steps.every((step) => Number.isInteger(step.right) && Number.isInteger(step.up))).toBe(true);
    expect(total()).toEqual({ right: AIM_STEPS_PER_SECOND, up: AIM_STEPS_PER_SECOND });
  });

  it("does not aim from a right stick resting inside the deadzone", () => {
    const { input, steps } = recorded();

    for (let i = 0; i < 100; i++) input.poll(pad({ axes: [0, 0, 0.1, 0.1] }), 50);

    expect(steps).toEqual([]);
  });

  it("holds to fire on the right trigger: press on the way down, release on the way up", () => {
    const { input, calls } = recorded();
    input.poll(pad(), 50);

    input.poll(pad({ fire: true }), 50);
    input.poll(pad({ fire: true }), 50);
    input.poll(pad(), 50);

    expect(calls).toEqual(["press", "release"]);
  });

  it("does not fire from a trigger already down at the first poll", () => {
    const { input, calls } = recorded();

    input.poll(pad({ fire: true }), 50);
    input.poll(pad({ fire: true }), 50);

    expect(calls).toEqual([]);
  });

  it("stops once on B, however long it is held", () => {
    const { input, calls } = recorded();
    input.poll(pad(), 50);

    input.poll(pad({ stop: true }), 50);
    input.poll(pad({ stop: true }), 50);

    expect(calls).toEqual(["stop"]);
  });

  it("releases the drive and the trigger when the pad disconnects", () => {
    const { input, calls, drive } = recorded();
    input.poll(pad(), 50);
    input.poll(pad({ axes: [0, -1, 0, 0], fire: true }), 50);

    input.poll(null, 50);

    expect(calls).toEqual(["press", "release"]);
    expect(drive()).toEqual({ forward: 0, side: 0, other: 0 });
  });
});
