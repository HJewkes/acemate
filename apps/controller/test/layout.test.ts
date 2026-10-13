import { describe, expect, it } from "vitest";
import { computeLayout } from "../src/ui/layout";

// Landscape window sizes in points: iPhone SE, iPhone 15, iPhone 17 Pro Max, iPad mini, iPad Pro 12.9.
const SCREENS = [
  { width: 667, height: 375 },
  { width: 852, height: 393 },
  { width: 956, height: 440 },
  { width: 1133, height: 744 },
  { width: 1366, height: 1024 },
];

describe("drive layout", () => {
  it.each(SCREENS)("fits the launcher's height and leaves the centre group room at %o", (screen) => {
    const layout = computeLayout(screen);

    expect(layout.column + 164).toBeLessThanOrEqual(screen.height - 76);
    expect(screen.width - 2 * layout.paddingH - 2 * layout.column).toBeGreaterThanOrEqual(200);
  });

  it("keeps the owner-tuned size on the iPhone 17 Pro Max", () => {
    expect(computeLayout({ width: 956, height: 440 })).toMatchObject({
      column: 200,
      paddingH: 56,
      nudgeX: 28,
      nudgeY: 20,
    });
  });

  it("caps the columns on a tablet so the controls don't sprawl", () => {
    expect(computeLayout({ width: 1366, height: 1024 }).column).toBe(260);
  });
});
