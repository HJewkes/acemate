import { describe, expect, it } from "vitest";
import { COURT_VIEW_BOX, courtToView, pixelToTarget, targetReadout, viewToCourt } from "../src/controls/court";

describe("pixelToTarget", () => {
  // A tall face: the box fills the height and is centred across, so padX matters.
  const size = { width: 200, height: 185 };
  const scale = 10;
  const padX = (200 - COURT_VIEW_BOX.width * scale) / 2;

  it("maps the box centre to the middle of the reachable depth", () => {
    expect(pixelToTarget(100, 92.5, size, false)).toEqual({ x: 0, z: 15.3 });
  });

  it("maps the box corners to the reachable limits, snapped to 0.1 m", () => {
    const left = padX;
    const right = padX + COURT_VIEW_BOX.width * scale;
    expect(pixelToTarget(left, 0, size, false)).toEqual({ x: -4.1, z: 23 });
    expect(pixelToTarget(right, 185, size, false)).toEqual({ x: 4.1, z: 7 });
  });

  it("reads a point inside the box on the correct side and depth", () => {
    // 3 m right of centre, 10 m deep: u = 3, v = -10.
    const px = padX + (3 - COURT_VIEW_BOX.minU) * scale;
    const py = (-10 - COURT_VIEW_BOX.minV) * scale;
    expect(pixelToTarget(px, py, size, false)).toEqual({ x: 3, z: 10 });
  });

  it("letterboxes a wide face along its height", () => {
    const wide = { width: 400, height: 185 };
    expect(pixelToTarget(200, 92.5, wide, false)).toEqual({ x: 0, z: 15.3 });
  });

  it("gives -x for a tap on the right half when flipX is on", () => {
    const px = 150;
    expect(pixelToTarget(px, 92.5, size, false).x).toBeGreaterThan(0);
    expect(pixelToTarget(px, 92.5, size, true).x).toBeLessThan(0);
  });
});

describe("view conversion", () => {
  it("round-trips a court point and flips u with flipX", () => {
    const point = { x: 2.5, z: 18 };
    expect(viewToCourt(courtToView(point, true), true)).toEqual(point);
    expect(courtToView(point, false)).toEqual({ u: 2.5, v: -18 });
    expect(courtToView(point, true).u).toBe(-2.5);
  });
});

describe("targetReadout", () => {
  it("is short and names the side the robot sees", () => {
    expect(targetReadout({ x: 1.3, z: 18.2 }, false)).toBe("R 1.3 m · 18.2 m");
    expect(targetReadout({ x: 1.3, z: 18.2 }, true)).toBe("L 1.3 m · 18.2 m");
    expect(targetReadout({ x: 0, z: 9 }, false)).toBe("centre · 9.0 m");
  });
});
