import { describe, expect, it } from "vitest";
import { applyStopLatch, gamepadToInput, keysToInput, pressKey, releaseKey } from "../src/input.js";
import { resolveMotion } from "../src/motion.js";

const press = (...codes: string[]) => codes.reduce(pressKey, new Set<string>());
const motionOf = (held: ReadonlySet<string>) => resolveMotion(keysToInput(held));

describe("held keys", () => {
  it("drives forward while W is held", () => {
    expect(motionOf(press("KeyW"))).toBe("go_front");
  });

  it("rotates when W and A are held together, per the rotate-first rule", () => {
    expect(motionOf(press("KeyW", "KeyA"))).toBe("turn_left");
  });

  it("strafes with Q and E", () => {
    expect(motionOf(press("KeyQ"))).toBe("go_left");
    expect(motionOf(press("KeyE"))).toBe("go_right");
  });

  it("falls back to the still-held key when the other is released", () => {
    expect(motionOf(releaseKey(press("KeyW", "KeyA"), "KeyA"))).toBe("go_front");
  });

  it("stops once every key is released", () => {
    const released = ["KeyW", "KeyA", "KeyE"].reduce(releaseKey, press("KeyW", "KeyA", "KeyE"));

    expect(motionOf(released)).toBe("stop");
  });

  it("cancels opposing keys", () => {
    expect(motionOf(press("KeyW", "KeyS"))).toBe("stop");
  });

  it("maps the arrow keys to forward and turning", () => {
    expect(motionOf(press("ArrowUp"))).toBe("go_front");
    expect(motionOf(press("ArrowRight"))).toBe("turn_right");
  });

  it("ignores keys that don't drive", () => {
    expect(press("KeyZ", "Space").size).toBe(0);
  });
});

describe("gamepad", () => {
  it("reads stick-up as forward and the right stick as turning", () => {
    expect(resolveMotion(gamepadToInput([0, -1, 0, 0]))).toBe("go_front");
    expect(resolveMotion(gamepadToInput([0, -1, -0.9, 0]))).toBe("turn_left");
  });
});

describe("emergency stop latch", () => {
  it("holds stop while input is still pushed", () => {
    expect(applyStopLatch(true, "go_front")).toEqual({ latched: true, motion: "stop" });
  });

  it("rearms once every input is neutral", () => {
    expect(applyStopLatch(true, "stop")).toEqual({ latched: false, motion: "stop" });
    expect(applyStopLatch(false, "go_front")).toEqual({ latched: false, motion: "go_front" });
  });
});
