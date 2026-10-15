import { describe, expect, it } from "vitest";
import { DEFAULT_PRESETS, parsePresets, presetMessage } from "../src/controls/presets";

// Copied from DEFAULT_PRESETS at 8135b0d, the last web build, as the page's export wrote it.
const OLD_WEB_EXPORT = JSON.stringify(
  [
    { name: "Deep feed", kind: "machine", direction: 0, speed: 6, spin: 1, elevation: 22 },
    { name: "Forehand wide", kind: "machine", direction: 10, speed: 6, spin: 1, elevation: 20 },
    { name: "Backhand wide", kind: "machine", direction: -10, speed: 6, spin: 1, elevation: 20 },
    { name: "Body", kind: "machine", direction: 0, speed: 7, spin: 0, elevation: 16 },
    { name: "Moonball", kind: "machine", direction: 0, speed: 5, spin: 3, elevation: 38 },
    { name: "Low slice", kind: "machine", direction: 0, speed: 5, spin: -2, elevation: 14 },
    { name: "Short drop", kind: "machine", direction: 0, speed: 2, spin: -3, elevation: 25 },
    { name: "Lob", kind: "machine", direction: 0, speed: 4, spin: 2, elevation: 40 },
    { name: "Target: deep middle", kind: "target", x: 0, z: 21, heightLevel: 4, spin: 1 },
    { name: "Target: deep right", kind: "target", x: 3.2, z: 21, heightLevel: 4, spin: 1 },
    { name: "Target: deep left", kind: "target", x: -3.2, z: 21, heightLevel: 4, spin: 1 },
    { name: "Target: short angle", kind: "target", x: 3.5, z: 15, heightLevel: 2, spin: 2 },
  ],
  null,
  2,
);

const machine = { name: "A", kind: "machine", direction: 0, speed: 5, spin: 0, elevation: 20 };
const target = { name: "T", kind: "target", x: 0, z: 18, heightLevel: 4, spin: 1 };

describe("parsePresets", () => {
  it("parses an old web export unchanged", () => {
    expect(parsePresets(OLD_WEB_EXPORT)).toEqual({ presets: DEFAULT_PRESETS });
  });

  it("rejects a target z below the drill limit, naming the preset", () => {
    const result = parsePresets(JSON.stringify([machine, { ...target, z: 6.9 }]));
    expect(result).toEqual({ error: expect.stringMatching(/^Preset 2 z must be/) });
  });

  it("rejects a machine spin outside the S10 range, naming the preset", () => {
    const result = parsePresets(JSON.stringify([{ ...machine, spin: 4 }]));
    expect(result).toEqual({ error: expect.stringMatching(/^Preset 1 spin must be/) });
  });

  it("rejects a fractional value on an integer step", () => {
    const result = parsePresets(JSON.stringify([{ ...machine, speed: 5.5 }]));
    expect(result).toEqual({ error: expect.stringMatching(/^Preset 1 speed must be/) });
  });

  it("rejects an empty array, a missing name and bad JSON", () => {
    expect(parsePresets("[]")).toEqual({ error: expect.stringMatching(/non-empty/) });
    const nameless = { ...target, name: "  " };
    expect(parsePresets(JSON.stringify([machine, target, nameless]))).toEqual({
      error: "Preset 3 needs a name.",
    });
    expect(parsePresets("{")).toEqual({ error: expect.stringMatching(/^Not JSON/) });
  });
});

describe("presetMessage", () => {
  it("sends a target preset as a drill with its height level and no count", () => {
    expect(presetMessage(target as never, 5, 3)).toEqual({
      kind: "target",
      x: 0,
      z: 18,
      heightLevel: 4,
      spin: 1,
    });
  });

  it("applies the chip's count and interval to a machine preset", () => {
    expect(presetMessage(DEFAULT_PRESETS[0]!, 3, 4)).toMatchObject({ kind: "machine", count: 3, interval: 4 });
    expect(presetMessage(DEFAULT_PRESETS[0]!)).toMatchObject({ count: 1, interval: 1 });
  });
});
