/** "stacked" puts the aim pad between speed and Fire; "wide" puts it beside them, for screens short on height. */
export type LauncherShape = "stacked" | "wide";

interface SharedLayout {
  /** The thumbstick diameter. */
  column: number;
  knob: number;
  /** Width of the stick column: at least the stick, and wide enough for the Strafe / Turn labels. */
  stickWidth: number;
  launcher: LauncherShape;
  /** Width of the launcher panel. */
  panel: number;
  /** Side of the square aim pad. */
  pad: number;
  /** Screen padding: clears the Dynamic Island, rounded corners and home indicator, from the safe-area insets. */
  paddingH: number;
  paddingTop: number;
  paddingBottom: number;
}

/** Landscape: the stick on the left, the device chip in the middle, the launcher on the right. */
export interface RowLayout extends SharedLayout {
  arrangement: "row";
  /** Inward and downward nudges the owner asked for, scaled down on small screens. */
  nudgeX: number;
  nudgeY: number;
}

/** Portrait: the header on top, then the launcher, then the stick at the bottom where the thumb rests. */
export interface ColumnLayout extends SharedLayout {
  arrangement: "column";
  /** Whether the spare height shows the ACEMATE wordmark above the launcher. */
  wordmark: boolean;
  /** Spare height above the launcher, holding the wordmark with a little room around it. */
  spacerTop: number;
  /** Spare height under the stick: most of the slack, so the launcher and stick sit higher (owner, 2026-10-14). */
  spacerBottom: number;
}

export type DriveLayout = RowLayout | ColumnLayout;
export type Arrangement = DriveLayout["arrangement"];

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export interface LayoutInput {
  width: number;
  height: number;
  /** The safe-area insets: the notch or Dynamic Island, and the home indicator. Zero in most browsers. */
  insets?: Insets;
}

// The launcher stacks spin, speed, the square pad, a readout and the fire bar: about column + 164 pt tall.
const PANEL_CHROME = 164;
// Minimum screen margins, kept even where there is no inset.
const MARGIN_H = 20;
const MARGIN_TOP = 8;
const MARGIN_BOTTOM = 14;
// The top bar plus a little breathing room; the screen padding is added to it.
const TOP_BAR = 44;
const BREATHING = 4;
const CENTRE_MIN = 200;
const COLUMN_MIN = 130;
// The wide shape's floor, for the shortest browser windows, where the stacked shape cannot fit at all.
const WIDE_MIN = 110;
const COLUMN_MAX = 260;
/** Narrower than this, "↔ Strafe" and the spin labels drop to icons. */
export const LABEL_MIN = 180;
/** Inner padding plus border of the launcher panel, on each side. */
export const PANEL_INSET = 12;
/** In the wide launcher, the column of spin, speed, readout and Fire beside the pad, and its gap to the pad. */
export const WIDE_SIDE = 160;
export const WIDE_GAP = 10;
/** The height spin, speed, a readout line and Fire need in that column, however small the pad beside it. */
export const WIDE_SIDE_HEIGHT = 150;
// Narrower than this, a portrait window cannot fit the landscape row, so it gets the column.
const ROW_MIN_WIDTH = 600;
// Below this stacked size the pad and labels get cramped, so a short, wide screen moves the pad beside the controls.
const WIDE_BELOW = 170;
// The Strafe / Turn switch and its gap above the stick.
export const STICK_SWITCH = 50;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type Sizing = Pick<SharedLayout, "launcher" | "column" | "stickWidth" | "panel" | "pad">;

/** Stick beside a stacked launcher: bound by height. Null when even the smallest stick's launcher is too tall. */
function stackedSizing(room: number, sides: number): Sizing | null {
  const byHeight = room - PANEL_CHROME;
  if (byHeight < COLUMN_MIN) return null;
  const column = Math.floor(clamp(Math.min(byHeight, sides / 2), COLUMN_MIN, COLUMN_MAX));
  const labelled = Math.max(column, Math.min(LABEL_MIN, Math.floor(sides / 2)));
  // The stacked pad keeps its historic size, the column less the panel's padding.
  return { launcher: "stacked", column, stickWidth: labelled, panel: labelled, pad: column - 20 };
}

/**
 * Stick beside a wide launcher, the pad as big as the stick: bound by width. The stick column keeps room for the
 * Strafe / Turn labels while it can; on the narrowest screens the labels drop to their icons instead.
 */
function wideSizing(room: number, sides: number): Sizing {
  const wideRoom = sides - WIDE_SIDE - WIDE_GAP - 2 * PANEL_INSET;
  const byHeight = room - STICK_SWITCH;
  const labelled = Math.min(byHeight, wideRoom / 2, wideRoom - LABEL_MIN);
  const keepLabels = labelled >= COLUMN_MIN;
  const column = Math.floor(clamp(keepLabels ? labelled : Math.min(byHeight, wideRoom / 2), WIDE_MIN, COLUMN_MAX));
  const stickWidth = keepLabels ? Math.max(column, LABEL_MIN) : column;
  return { launcher: "wide", column, stickWidth, panel: column + WIDE_SIDE + WIDE_GAP + 2 * PANEL_INSET, pad: column };
}

/** Stacked unless it would be cramped (or too tall) and the wide shape gives a bigger stick. */
function chooseSizing(room: number, sides: number): Sizing {
  const stacked = stackedSizing(room, sides);
  const wide = wideSizing(room, sides);
  if (!stacked) return wide;
  return stacked.column < WIDE_BELOW && wide.column > stacked.column ? wide : stacked;
}

/** The launcher panel's height for a layout, from its pad and chrome. */
export function launcherHeight(layout: Pick<SharedLayout, "launcher" | "column" | "pad">): number {
  if (layout.launcher === "stacked") return layout.column + PANEL_CHROME;
  return Math.max(layout.pad, WIDE_SIDE_HEIGHT) + 2 * PANEL_INSET;
}

/** Sizes the stick and launcher from the window so the screen fits any landscape phone, tablet or browser. */
export function computeLayout({ width, height, insets = NO_INSETS }: LayoutInput): RowLayout {
  // Both sides take the larger inset, so the stick and launcher mirror whichever way the phone is turned.
  const paddingH = Math.max(MARGIN_H, insets.left, insets.right);
  const paddingTop = Math.max(MARGIN_TOP, insets.top);
  const paddingBottom = Math.max(MARGIN_BOTTOM, insets.bottom);
  const sides = width - 2 * paddingH - CENTRE_MIN;
  const room = height - TOP_BAR - paddingTop - paddingBottom - BREATHING;
  const sizing = chooseSizing(room, sides);
  const { column } = sizing;
  const slack = sides - sizing.stickWidth - sizing.panel;
  return {
    arrangement: "row",
    ...sizing,
    knob: Math.round(column * 0.37),
    paddingH,
    paddingTop,
    paddingBottom,
    nudgeX: Math.round(clamp(slack / 6, 0, 28)),
    nudgeY: column >= 180 ? 20 : 8,
  };
}

/** Portrait phones and narrow Split View windows get the column; tablets in portrait keep the row. */
export function chooseArrangement({ width, height }: LayoutInput): Arrangement {
  return height > width && width < ROW_MIN_WIDTH ? "column" : "row";
}
