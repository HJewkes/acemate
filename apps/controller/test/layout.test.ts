import { describe, expect, it } from "vitest";
import { computeLayout, launcherHeight } from "../src/ui/layout";

// Landscape window sizes in points: iPhone SE, iPhone 15, iPhone 17 Pro Max, iPad mini, iPad Pro 12.9.
const SCREENS = [
  { width: 667, height: 375 },
  { width: 852, height: 393 },
  { width: 956, height: 440 },
  { width: 1133, height: 744 },
  { width: 1366, height: 1024 },
];

// Bluefy on an iPhone 17 Pro Max in landscape: the browser letterboxes the page and its toolbar takes the height.
const BLUEFY = { width: 833, height: 360, inset: false };

describe("drive layout", () => {
  it.each([...SCREENS, BLUEFY])("fits the launcher's height and leaves the centre group room at %o", (screen) => {
    const layout = computeLayout(screen);

    expect(launcherHeight(layout)).toBeLessThanOrEqual(screen.height - 76);
    expect(layout.column + 50).toBeLessThanOrEqual(screen.height - 76);
    expect(screen.width - 2 * layout.paddingH - layout.stickWidth - layout.panel).toBeGreaterThanOrEqual(200);
  });

  it.each([...SCREENS, BLUEFY])("leaves the switch and spin labels room at %o", (screen) => {
    const layout = computeLayout(screen);

    expect(layout.stickWidth).toBeGreaterThanOrEqual(180);
    expect(layout.panel).toBeGreaterThanOrEqual(180);
  });

  it("puts the pad beside the controls on a short browser window, so neither side shrinks to the minimum", () => {
    const layout = computeLayout(BLUEFY);

    expect(layout).toMatchObject({ launcher: "wide", paddingH: 20 });
    expect(layout.pad).toBeGreaterThanOrEqual(190);
    expect(layout.column).toBe(layout.pad);
  });

  it("keeps the owner-tuned size on the iPhone 17 Pro Max", () => {
    expect(computeLayout({ width: 956, height: 440 })).toMatchObject({
      column: 200,
      launcher: "stacked",
      panel: 200,
      pad: 180,
      paddingH: 56,
      nudgeX: 28,
      nudgeY: 20,
    });
  });

  it("caps the columns on a tablet so the controls don't sprawl", () => {
    expect(computeLayout({ width: 1366, height: 1024 }).column).toBe(260);
  });
});
