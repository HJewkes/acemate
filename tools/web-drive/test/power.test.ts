import { describe, expect, it } from "vitest";
import { batteryBars, powerText } from "../src/page/power.js";

describe("batteryBars", () => {
  it("matches the app's levels: 0 only at 0%, 1 for 1-19%, then 20% steps", () => {
    expect([0, 1, 19, 20, 39, 40, 60, 79, 80, 100].map(batteryBars)).toEqual([0, 1, 1, 2, 2, 3, 4, 4, 5, 5]);
  });

  it("treats a missing or out-of-range value as unknown", () => {
    expect(batteryBars(null)).toBeNull();
    expect(batteryBars(130)).toBeNull();
  });
});

describe("powerText", () => {
  it("shows the meter, raw percentage, mode and run state", () => {
    const text = powerText({ bat: 64, mode: "rally", running: false }, new Date(0));

    expect(text).toContain("▮▮▮▮▯ 64%");
    expect(text).toContain("rally · idle");
  });
});
