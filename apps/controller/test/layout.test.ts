import { describe, expect, it } from "vitest";
import { computeLayout, launcherHeight } from "../src/ui/layout";

const island = (side: number, bottom: number) => ({ top: 0, right: side, bottom, left: side });

// Landscape screens in points with their safe-area insets: iPhone SE, iPhone 15, iPhone 17 Pro Max, iPad mini, iPad Pro.
const SCREENS = [
  { width: 667, height: 375 },
  { width: 852, height: 393, insets: island(59, 21) },
  { width: 956, height: 440, insets: island(62, 20) },
  { width: 1133, height: 744, insets: { top: 0, right: 0, bottom: 20, left: 0 } },
  { width: 1366, height: 1024, insets: { top: 0, right: 0, bottom: 20, left: 0 } },
];

// Bluefy on an iPhone 17 Pro Max in landscape: the browser letterboxes the page and its toolbar takes the height.
const BLUEFY = { width: 833, height: 360 };
// Bluefy on an iPhone SE: too short for the stacked launcher at any size, and narrow.
const BLUEFY_SE = { width: 667, height: 320 };

describe("drive layout", () => {
  it.each([...SCREENS, BLUEFY, BLUEFY_SE])(
    "fits the launcher's height and leaves the centre group room at %o",
    (screen) => {
      const layout = computeLayout(screen);

      const room = screen.height - 44 - layout.paddingTop - layout.paddingBottom;
      expect(launcherHeight(layout)).toBeLessThanOrEqual(room);
      expect(layout.column + 50).toBeLessThanOrEqual(room);
      expect(screen.width - 2 * layout.paddingH - layout.stickWidth - layout.panel).toBeGreaterThanOrEqual(200);
    },
  );

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

  it("drops the stick's labels to icons rather than overflow the shortest, narrowest window", () => {
    const layout = computeLayout(BLUEFY_SE);

    expect(layout.launcher).toBe("wide");
    expect(layout.stickWidth).toBe(layout.column);
  });

  it("keeps the padding clear of the Dynamic Island and home indicator", () => {
    const layout = computeLayout({ width: 852, height: 393, insets: { top: 0, right: 0, bottom: 21, left: 59 } });

    expect(layout).toMatchObject({ paddingH: 59, paddingBottom: 21 });
  });

  it("keeps the owner-tuned size on the iPhone 17 Pro Max", () => {
    expect(computeLayout({ width: 956, height: 440, insets: island(62, 20) })).toMatchObject({
      column: 200,
      launcher: "stacked",
      panel: 200,
      pad: 180,
      paddingH: 62,
      nudgeX: 28,
      nudgeY: 20,
    });
  });

  it("caps the columns on a tablet so the controls don't sprawl", () => {
    expect(computeLayout({ width: 1366, height: 1024 }).column).toBe(260);
  });
});
