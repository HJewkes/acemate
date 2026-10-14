import { describe, expect, it } from "vitest";
import { chooseArrangement, type ColumnLayout } from "../src/ui/layout";
import {
  FIRE_GUARD,
  HEADER,
  HEADER_GAP,
  computeDriveLayout,
  computePortraitLayout,
  portraitLauncherHeight,
} from "../src/ui/layout-portrait";

const portrait = (top: number, bottom: number) => ({ top, right: 0, bottom, left: 0 });

// Portrait phones in points with their insets, then browser windows whose toolbars take height.
const PHONES = [
  { width: 375, height: 667 },
  { width: 393, height: 852, insets: portrait(59, 34) },
  { width: 440, height: 956, insets: portrait(62, 34) },
  { width: 360, height: 780, insets: portrait(32, 24) },
  { width: 412, height: 915, insets: portrait(32, 24) },
];
const BROWSERS = [
  { width: 440, height: 790 },
  { width: 393, height: 659 },
  { width: 375, height: 548 },
  { width: 360, height: 640 },
];

// The switch's own height, between the Fire guard and the stick.
const STICK_SWITCH = 50;

function stackHeight(layout: ColumnLayout): number {
  const used = HEADER + HEADER_GAP + portraitLauncherHeight(layout) + FIRE_GUARD + STICK_SWITCH + layout.column;
  return layout.paddingTop + used + layout.paddingBottom;
}

describe("portrait layout", () => {
  it.each([...PHONES, ...BROWSERS])("fits the header, launcher and stick in the height at %o", (screen) => {
    const layout = computePortraitLayout(screen);

    expect(stackHeight(layout)).toBeLessThanOrEqual(screen.height);
    expect(layout.panel).toBeLessThanOrEqual(screen.width - 2 * layout.paddingH);
    expect(layout.stickWidth).toBeGreaterThanOrEqual(180);
  });

  it.each(PHONES)("keeps the stick and pad a usable size on a phone at %o", (screen) => {
    const layout = computePortraitLayout(screen);

    expect(layout.launcher).toBe("stacked");
    expect(layout.column).toBeGreaterThanOrEqual(150);
    expect(layout.pad).toBeGreaterThanOrEqual(150);
  });

  it("clears the Dynamic Island and home indicator on the iPhone 17 Pro Max", () => {
    const layout = computePortraitLayout({ width: 440, height: 956, insets: portrait(62, 34) });

    expect(layout).toMatchObject({ paddingTop: 62, paddingBottom: 34, column: 220, pad: 260 });
  });

  it("moves the pad beside the controls in a short browser window", () => {
    const layout = computePortraitLayout({ width: 375, height: 548 });

    expect(layout.launcher).toBe("wide");
    expect(layout.column).toBeGreaterThanOrEqual(150);
  });

  it("keeps the stick clear of Fire: the guard and the switch sit between them", () => {
    expect(FIRE_GUARD + STICK_SWITCH).toBeGreaterThanOrEqual(60);
  });
});

describe("choosing the arrangement", () => {
  it("uses the column on a portrait phone and the row in landscape", () => {
    expect(chooseArrangement({ width: 393, height: 852 })).toBe("column");
    expect(chooseArrangement({ width: 852, height: 393 })).toBe("row");
  });

  it("keeps the row on a portrait iPad but not in narrow Split View", () => {
    expect(computeDriveLayout({ width: 744, height: 1133 }).arrangement).toBe("row");
    expect(computeDriveLayout({ width: 375, height: 1133 }).arrangement).toBe("column");
  });
});
