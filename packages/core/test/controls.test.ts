import { describe, expect, it } from "vitest";
import { aimToPad, directionLabel, padToAim, pixelToAim } from "../src/controls/aim";
import { flipped, parseAssumptions } from "../src/controls/assumptions";
import { describeShot } from "../src/controls/describe-shot";
import { SPANS, snapTo, stepBy } from "../src/controls/ranges";
import { spinLabel, spinStyle, spinValue } from "../src/controls/spin";

describe("snapping and stepping", () => {
  it("snaps 0.1 m targets without float noise and clamps inside the S10 limits", () => {
    expect(snapTo(2.34999, SPANS.targetX)).toBe(2.3);
    expect(snapTo(9, SPANS.targetX)).toBe(4.1);
    expect(snapTo(-9, SPANS.targetX)).toBe(-4.1);
    expect(snapTo(6.96, SPANS.targetZ)).toBe(7);
  });

  it("steps the interval in half seconds and stops at the ends", () => {
    expect(stepBy(4, 1, SPANS.interval)).toBe(4.5);
    expect(stepBy(15, 1, SPANS.interval)).toBe(15);
    expect(stepBy(1, -1, SPANS.interval)).toBe(1);
  });
});

describe("assumptions", () => {
  it("flips a value without producing -0", () => {
    expect(flipped(7, true)).toBe(-7);
    expect(Object.is(flipped(0, true), 0)).toBe(true);
    expect(flipped(7, false)).toBe(7);
  });

  it("falls back to the defaults for missing or broken storage", () => {
    expect(parseAssumptions(null)).toEqual({ flipDirection: false, flipX: false, robotZ: 0 });
    expect(parseAssumptions("{oops")).toEqual({ flipDirection: false, flipX: false, robotZ: 0 });
    expect(parseAssumptions('{"flipX":true,"robotZ":-1}')).toEqual({ flipDirection: false, flipX: true, robotZ: -1 });
  });
});

describe("aim pad mapping", () => {
  it("maps the pad corners onto the S10 direction and elevation limits", () => {
    expect(padToAim({ fx: 0, fy: 0 }, false)).toEqual({ direction: -15, elevation: 40 });
    expect(padToAim({ fx: 1, fy: 1 }, false)).toEqual({ direction: 15, elevation: 10 });
    expect(padToAim({ fx: 0.5, fy: 0.5 }, false)).toEqual({ direction: 0, elevation: 25 });
  });

  it("clamps drags past the pad edge", () => {
    expect(pixelToAim(-50, 999, { width: 300, height: 300 }, false)).toEqual({ direction: -15, elevation: 10 });
  });

  it("sends the opposite direction for the same screen spot when direction is flipped", () => {
    expect(padToAim({ fx: 0.8, fy: 0.5 }, true).direction).toBe(-padToAim({ fx: 0.8, fy: 0.5 }, false).direction);
    expect(aimToPad({ direction: -15, elevation: 10 }, true)).toEqual({ fx: 1, fy: 1 });
  });

  it("labels direction from the robot's point of view", () => {
    expect(directionLabel(7, false)).toBe("R 7°");
    expect(directionLabel(7, true)).toBe("L 7°");
    expect(directionLabel(0, true)).toBe("centre");
  });
});

describe("spin labels", () => {
  it("names the three coarse spins and keeps the level", () => {
    expect([spinValue("slice"), spinValue("flat"), spinValue("topspin")]).toEqual([-2, 0, 2]);
    expect(spinStyle(-1)).toBe("slice");
    expect(spinLabel(0)).toBe("flat");
    expect(spinLabel(3)).toBe("topspin 3");
    expect(spinLabel(-2)).toBe("slice 2");
  });
});

describe("shot description", () => {
  it("summarises the shot Fire would send", () => {
    const shot = { kind: "machine", direction: 4, speed: 6, spin: 2, elevation: 30, count: 3, interval: 2 } as const;

    expect(describeShot(shot, false)).toBe("R 4° · elev 30° · speed 6 · topspin 2 · 3 balls every 2 s");
    expect(describeShot(null, false)).toBe("nothing to fire");
  });
});
