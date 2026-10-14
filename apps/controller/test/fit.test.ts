import { describe, expect, it } from "vitest";
import { FULL, chooseFit } from "../src/ui/text/fit";

describe("fitting a label without an ellipsis", () => {
  it("keeps a label that fits at full size", () => {
    expect(chooseFit({ natural: 80, available: 100 })).toEqual(FULL);
  });

  it("shrinks a label that is a little too wide", () => {
    const fit = chooseFit({ natural: 100, available: 90 });

    expect(fit.short).toBe(false);
    expect(fit.scale).toBeLessThanOrEqual(0.9);
    expect(fit.scale).toBeGreaterThan(0.85);
  });

  it("falls back to the short form once shrinking would pass the minimum", () => {
    expect(chooseFit({ natural: 100, available: 50, hasShort: true })).toEqual({ scale: 1, short: true, lines: 1 });
  });

  it("wraps at the minimum size when there is no short form", () => {
    expect(chooseFit({ natural: 100, available: 50, maxLines: 2 })).toEqual({ scale: 0.75, short: false, lines: 2 });
  });
});
