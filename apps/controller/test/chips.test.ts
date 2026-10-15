import { describe, expect, it } from "vitest";
import { ballsNote, chipLabels, holdPrompt } from "../src/launcher/chips";
import { DEFAULT_SHOT } from "../src/launcher/shot";

const labelsFor = (change: Partial<typeof DEFAULT_SHOT>) => chipLabels({ ...DEFAULT_SHOT, ...change });

describe("launcher chips", () => {
  it("names one ball in words and several as count × interval", () => {
    expect(labelsFor({ count: 1, interval: 4 }).balls).toEqual({ label: "1 ball", short: "1" });
    expect(labelsFor({ count: 3, interval: 4 }).balls).toEqual({ label: "3 × 4 s", short: "3×4" });
    expect(labelsFor({ count: 3, interval: 1.5 }).balls).toEqual({ label: "3 × 1.5 s", short: "3×1.5" });
  });

  it("names the spin style with its strength, and flat alone", () => {
    expect(labelsFor({ spin: 2 }).spin).toEqual({ label: "Top 2", short: "T2" });
    expect(labelsFor({ spin: 0 }).spin).toEqual({ label: "Flat", short: "F" });
    expect(labelsFor({ spin: -3 }).spin).toEqual({ label: "Slice 3", short: "S3" });
  });

  it("puts the ball count on Fire whenever one hold fires more than one", () => {
    expect(holdPrompt(1)).toEqual({ label: "HOLD TO FIRE", short: "FIRE" });
    expect(holdPrompt(3)).toEqual({ label: "HOLD · 3 BALLS", short: "FIRE ×3" });
  });

  it("adds the count to the readout only above one ball", () => {
    expect(ballsNote({ count: 1, interval: 4 })).toBe("");
    expect(ballsNote({ count: 3, interval: 4 })).toBe("3 balls / 4 s");
  });
});
