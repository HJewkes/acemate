import { describe, expect, it } from "vitest";
import { MOTION_RULE, combineInputs, resolveMotion, type MotionRule } from "../src/motion.js";

const input = (x: number, y: number, turn: number) => ({ x, y, turn });

describe("resolveMotion with the default rotate-first rule", () => {
  it("stops when every axis is inside the deadzone", () => {
    expect(resolveMotion(input(0.25, -0.2, 0.25))).toBe("stop");
  });

  it("picks the dominant translate axis just past the deadzone", () => {
    expect(resolveMotion(input(0, 0.26, 0))).toBe("go_front");
    expect(resolveMotion(input(0, -0.9, 0))).toBe("go_back");
    expect(resolveMotion(input(-0.8, 0.5, 0))).toBe("go_left");
    expect(resolveMotion(input(0.8, -0.5, 0))).toBe("go_right");
  });

  it("prefers forward/back when the translate axes tie", () => {
    expect(resolveMotion(input(0.7, 0.7, 0))).toBe("go_front");
  });

  it("lets rotation over the threshold beat a full translation", () => {
    expect(resolveMotion(input(0, 1, -0.51))).toBe("turn_left");
    expect(resolveMotion(input(1, 0, 0.6))).toBe("turn_right");
  });

  it("lets translation beat rotation at or under the threshold", () => {
    expect(resolveMotion(input(0, 1, 0.5))).toBe("go_front");
  });

  it("turns on a gentle twist when nothing else is pushed", () => {
    expect(resolveMotion(input(0.1, 0, 0.4))).toBe("turn_right");
  });
});

describe("resolveMotion with a configured rule", () => {
  it("lets any translation win under translate priority", () => {
    const rule: MotionRule = { ...MOTION_RULE, priority: "translate" };

    expect(resolveMotion(input(0, 0.3, 1), rule)).toBe("go_front");
    expect(resolveMotion(input(0, 0.2, 1), rule)).toBe("turn_right");
  });

  it("honours a wider deadzone", () => {
    expect(resolveMotion(input(0, 0.4, 0), { ...MOTION_RULE, deadzone: 0.5 })).toBe("stop");
  });
});

describe("combineInputs", () => {
  it("keeps the stronger push per axis so keys and sticks don't cancel", () => {
    expect(combineInputs(input(0, 1, 0), input(0.3, -0.2, -0.7))).toEqual(input(0.3, 1, -0.7));
  });
});
