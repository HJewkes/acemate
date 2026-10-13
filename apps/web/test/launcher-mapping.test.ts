import { describe, expect, it } from "vitest";
import { setModeFor } from "../../../tools/web-drive/src/launcher.js";
import { aimToPad, directionLabel, padToAim, pixelToAim } from "../src/launcher-ui/aim.js";
import { flipped, parseAssumptions } from "../src/launcher-ui/assumptions.js";
import { courtToSvg, courtViewBox, pixelToSvg, pixelToTarget, snapTarget, svgToCourt } from "../src/launcher-ui/court.js";
import { DEFAULT_PRESETS, MAX_QUEUE, parsePresets, presetMessage, queueMessage, queueRefusal, type Preset } from "../src/launcher-ui/presets.js";
import { SPANS, snapTo, stepBy } from "../src/launcher-ui/ranges.js";
import { spinLabel, spinStyle, spinValue } from "../src/launcher-ui/spin.js";
import { describeShot, initialVariant } from "../src/launcher-ui/variant.js";

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

describe("court map mapping", () => {
  const size = { width: 400, height: 400 };

  it("round-trips court points through both orientations and the x flip", () => {
    for (const orientation of ["vertical", "horizontal"] as const) {
      for (const flipX of [false, true]) {
        const point = { x: 2.5, z: 18 };
        expect(svgToCourt(courtToSvg(point, orientation, flipX), orientation, flipX)).toEqual(point);
      }
    }
  });

  it("draws +x to the robot's right: screen right when vertical, screen down when the robot faces right", () => {
    expect(courtToSvg({ x: 1, z: 10 }, "vertical", false)).toEqual({ u: 1, v: -10 });
    expect(courtToSvg({ x: 1, z: 10 }, "horizontal", false)).toEqual({ u: 10, v: 1 });
    expect(courtToSvg({ x: 1, z: 10 }, "vertical", true).u).toBe(-1);
  });

  it("accounts for the letterbox bars of a meet-scaled svg", () => {
    const box = { minU: 0, minV: 0, width: 10, height: 20 };

    expect(pixelToSvg(200, 200, size, box)).toEqual({ u: 5, v: 10 });
    expect(pixelToSvg(100, 0, size, box)).toEqual({ u: 0, v: 0 });
  });

  it("puts a tap at the centre of a vertical court on the centre line, snapped to 0.1 m", () => {
    const view = { orientation: "vertical" as const, flipX: false, robotZ: 0 };
    const box = courtViewBox("vertical", 0);
    const scale = Math.min(size.width / box.width, size.height / box.height);
    const padX = (size.width - box.width * scale) / 2;
    const atZ18 = (-18 - box.minV) * scale;

    expect(pixelToTarget(size.width / 2 + 0.013 * scale, atZ18, size, view)).toEqual({ x: 0, z: 18 });
    expect(pixelToTarget(padX + box.width * scale, atZ18, size, view).x).toBe(4.1);
    expect(pixelToTarget(size.width / 2, size.height, size, view).z).toBe(7);
  });

  it("mirrors a tap when the court x is flipped", () => {
    const tap = (flipX: boolean) => pixelToTarget(300, 150, size, { orientation: "vertical", flipX, robotZ: 0 });

    expect(tap(true).x).toBe(-tap(false).x);
  });

  it("clamps targets outside the drill box", () => {
    expect(snapTarget({ x: -5, z: 30 })).toEqual({ x: -4.1, z: 23 });
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

describe("presets", () => {
  const [deep, wide] = DEFAULT_PRESETS as [Preset, Preset];
  const target = DEFAULT_PRESETS.find((preset) => preset.kind === "target")!;

  it("builds one ordered multi-ball ball_machine from the queue", () => {
    const message = queueMessage([deep, wide, deep], 2.5)!;

    expect(setModeFor(message)).toMatchObject({
      data: { mode: "ball_machine", b: [[0, 6, 1, 22], [-10, 6, 1, 20], [0, 6, 1, 22]], total_balls: 3, interval: 2.5, random_order: false },
    });
  });

  it("has nothing to fire for an empty queue", () => {
    expect(queueMessage([], 3)).toBeNull();
  });

  it("refuses target presets and a full queue", () => {
    expect(queueRefusal([], target)).toMatch(/Target presets/);
    expect(queueRefusal(Array<Preset>(MAX_QUEUE).fill(deep), deep)).toMatch(/at most 10/);
    expect(queueRefusal([deep], wide)).toBeNull();
  });

  it("fires a single machine preset as one ball and a target preset as a drill", () => {
    expect(setModeFor(presetMessage(wide))).toMatchObject({ data: { mode: "ball_machine", b: [[-10, 6, 1, 20]], total_balls: 1 } });
    expect(setModeFor(presetMessage(target))).toMatchObject({ data: { mode: "drill" } });
  });

  it("accepts the default list as JSON and rejects out-of-range or malformed presets", () => {
    expect(parsePresets(JSON.stringify(DEFAULT_PRESETS))).toEqual({ presets: DEFAULT_PRESETS });
    expect(parsePresets('[{"name":"x","kind":"machine","direction":20,"speed":5,"spin":0,"elevation":20}]')).toEqual({
      error: "Preset 1 direction must be a number in -15..15 (step 1).",
    });
    expect(parsePresets('[{"name":"x","kind":"lob"}]')).toMatchObject({ error: expect.stringMatching(/kind/) });
    expect(parsePresets("[]")).toMatchObject({ error: expect.stringMatching(/non-empty/) });
    expect(parsePresets("nope")).toMatchObject({ error: expect.stringMatching(/Not JSON/) });
  });
});

describe("variant choice", () => {
  it("prefers the URL, then storage, then A", () => {
    expect(initialVariant("C", "b")).toBe("c");
    expect(initialVariant("z", "b")).toBe("b");
    expect(initialVariant(null, null)).toBe("a");
  });

  it("summarises the shot Fire would send", () => {
    const shot = { kind: "machine", direction: 4, speed: 6, spin: 2, elevation: 30, count: 3, interval: 2 } as const;

    expect(describeShot(shot, false)).toBe("R 4° · elev 30° · speed 6 · topspin 2 · 3 balls every 2 s");
    expect(describeShot(null, false)).toBe("nothing to fire");
  });
});
