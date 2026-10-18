import { describe, expect, it } from "vitest";
import {
  DIAGONAL_SPEED_LEVELS,
  MOTION_RULE,
  combineInputs,
  resolveDiagonalMotion,
  resolveMotion,
  resolveSpeedMotion,
  type MotionRule,
} from "../src/drive/motion";

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

describe("resolveDiagonalMotion", () => {
  it("picks the nearest of eight directions by the stick's angle", () => {
    expect(resolveDiagonalMotion(input(0, 1, 0))).toBe("go_front");
    expect(resolveDiagonalMotion(input(0.7, 0.7, 0))).toBe("go_front_right");
    expect(resolveDiagonalMotion(input(1, 0, 0))).toBe("go_right");
    expect(resolveDiagonalMotion(input(0.7, -0.7, 0))).toBe("go_back_right");
    expect(resolveDiagonalMotion(input(0, -1, 0))).toBe("go_back");
    expect(resolveDiagonalMotion(input(-0.7, -0.7, 0))).toBe("go_back_left");
    expect(resolveDiagonalMotion(input(-1, 0, 0))).toBe("go_left");
    expect(resolveDiagonalMotion(input(-0.7, 0.7, 0))).toBe("go_front_left");
  });

  it("splits octants at 22.5 degrees off a cardinal", () => {
    const near = Math.tan((22 * Math.PI) / 180);
    const past = Math.tan((23 * Math.PI) / 180);

    expect(resolveDiagonalMotion(input(near, 1, 0))).toBe("go_front");
    expect(resolveDiagonalMotion(input(past, 1, 0))).toBe("go_front_right");
    expect(resolveDiagonalMotion(input(-past, -1, 0))).toBe("go_back_left");
  });

  it("keeps resolveMotion's deadzone and turn rules", () => {
    expect(resolveDiagonalMotion(input(0.2, 0.2, 0))).toBe("stop");
    expect(resolveDiagonalMotion(input(0.7, 0.7, -0.6))).toBe("turn_left");
    expect(resolveDiagonalMotion(input(0, 0, 0.4))).toBe("turn_right");
  });

  it("leaves the stock resolver on four directions", () => {
    expect(resolveMotion(input(0.7, 0.7, 0))).toBe("go_front");
  });
});

describe("resolveSpeedMotion", () => {
  it("grades speed from 1 just past the deadzone to the top level at full push", () => {
    expect(resolveSpeedMotion(input(0, 0.26, 0))).toEqual({ motion: "go_front", speed: 1 });
    expect(resolveSpeedMotion(input(0, 0.6, 0))).toEqual({ motion: "go_front", speed: 3 });
    expect(resolveSpeedMotion(input(0, -1, 0))).toEqual({ motion: "go_back", speed: DIAGONAL_SPEED_LEVELS });
  });

  it("clamps a corner push, longer than one, to the top level", () => {
    expect(resolveSpeedMotion(input(1, 1, 0))).toEqual({ motion: "go_front_right", speed: 5 });
  });

  it("grades a turn by the twist alone", () => {
    expect(resolveSpeedMotion(input(0, 0, -1))).toEqual({ motion: "turn_left", speed: 5 });
    expect(resolveSpeedMotion(input(0, 0, 0.3))).toEqual({ motion: "turn_right", speed: 1 });
  });
});
