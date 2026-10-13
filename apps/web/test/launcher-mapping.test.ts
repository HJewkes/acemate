import { describe, expect, it } from "vitest";
import { setModeFor } from "@acemate/core";
import {
  courtToSvg,
  courtViewBox,
  pixelToSvg,
  pixelToTarget,
  snapTarget,
  svgToCourt,
} from "../src/launcher-ui/court.js";
import {
  DEFAULT_PRESETS,
  MAX_QUEUE,
  parsePresets,
  presetMessage,
  queueMessage,
  queueRefusal,
  type Preset,
} from "../src/launcher-ui/presets.js";
import { initialVariant } from "../src/launcher-ui/variant.js";

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

describe("presets", () => {
  const [deep, wide] = DEFAULT_PRESETS as [Preset, Preset];
  const target = DEFAULT_PRESETS.find((preset) => preset.kind === "target")!;

  it("builds one ordered multi-ball ball_machine from the queue", () => {
    const message = queueMessage([deep, wide, deep], 2.5)!;

    expect(setModeFor(message)).toMatchObject({
      data: {
        mode: "ball_machine",
        b: [
          [0, 6, 1, 22],
          [-10, 6, 1, 20],
          [0, 6, 1, 22],
        ],
        total_balls: 3,
        interval: 2.5,
        random_order: false,
      },
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
    expect(setModeFor(presetMessage(wide))).toMatchObject({
      data: { mode: "ball_machine", b: [[-10, 6, 1, 20]], total_balls: 1 },
    });
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
});
