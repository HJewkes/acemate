import {
  LABEL_MIN,
  NO_INSETS,
  PANEL_INSET,
  WIDE_GAP,
  WIDE_SIDE,
  WIDE_SIDE_HEIGHT,
  chooseArrangement,
  clamp,
  computeLayout,
  type ColumnLayout,
  type DriveLayout,
  type LayoutInput,
} from "./layout";

// Screen margins where there is no inset.
const MARGIN_H = 16;
const MARGIN_TOP = 8;
const MARGIN_BOTTOM = 12;
/** The header row (device chip, Keys, run chip) and the gap under it. */
export const HEADER = 44;
export const HEADER_GAP = 12;
/** The stacked launcher's height less its pad: spin, speed, a two-line readout, Fire, padding and gaps. */
const STACKED_CHROME = 192;
/** Space between Fire and the Strafe / Turn switch, so a thumb on the switch is well clear of Fire. */
export const FIRE_GUARD = 16;
/** The Strafe / Turn switch and its gap above the stick. */
const STICK_SWITCH = 50;
// The stick and pad stay near the owner-tuned landscape stick (200), and the pad no larger than is useful.
const STICK_MAX = 220;
const PAD_MAX = 260;
// Under this, the stacked stick or pad is too small and the pad moves beside the controls.
const STACKED_MIN = 150;
const STICK_MIN = 110;
const PAD_MIN = 110;
// The stick never takes more than this share of the width, leaving the thumb room around it.
const STICK_WIDTH_SHARE = 0.6;
// Everything that is not the stick or the pad: header, gaps, the launcher's chrome and the switch.
const FIXED = HEADER + HEADER_GAP + FIRE_GUARD + STICK_SWITCH;

interface Frame {
  paddingH: number;
  paddingTop: number;
  paddingBottom: number;
  /** Width inside the side padding. */
  content: number;
  /** Height inside the top and bottom padding. */
  room: number;
}

function portraitFrame({ width, height, insets = NO_INSETS }: LayoutInput): Frame {
  const paddingH = Math.max(MARGIN_H, insets.left, insets.right);
  const paddingTop = Math.max(MARGIN_TOP, insets.top);
  const paddingBottom = Math.max(MARGIN_BOTTOM, insets.bottom);
  return {
    paddingH,
    paddingTop,
    paddingBottom,
    content: width - 2 * paddingH,
    room: height - paddingTop - paddingBottom,
  };
}

type Sizing = Pick<ColumnLayout, "launcher" | "column" | "pad">;

/** The pad between speed and Fire, sharing the height with the stick. Null when either would be too small. */
function stackedSizing({ content, room }: Frame): Sizing | null {
  const share = room - FIXED - STACKED_CHROME;
  const column = Math.floor(clamp(Math.min(share / 2, STICK_WIDTH_SHARE * content), STICK_MIN, STICK_MAX));
  const pad = Math.floor(Math.min(share - column, content - 2 * PANEL_INSET, PAD_MAX));
  return column < STACKED_MIN || pad < STACKED_MIN ? null : { launcher: "stacked", column, pad };
}

/** For short windows: the pad beside spin, speed, readout and Fire, as in landscape's wide launcher. */
function compactSizing({ content, room }: Frame): Sizing {
  const pad = Math.floor(clamp(content - 2 * PANEL_INSET - WIDE_SIDE - WIDE_GAP, PAD_MIN, PAD_MAX));
  const launcher = Math.max(pad, WIDE_SIDE_HEIGHT) + 2 * PANEL_INSET;
  const byHeight = room - FIXED - launcher;
  const column = Math.floor(clamp(Math.min(byHeight, STICK_WIDTH_SHARE * content), STICK_MIN, STICK_MAX));
  return { launcher: "wide", column, pad };
}

/** The launcher panel's height in portrait. */
export function portraitLauncherHeight({ launcher, pad }: Pick<ColumnLayout, "launcher" | "pad">): number {
  return launcher === "stacked" ? pad + STACKED_CHROME : Math.max(pad, WIDE_SIDE_HEIGHT) + 2 * PANEL_INSET;
}

/** Sizes the portrait screen: the launcher at full width, the stick below it, any spare height above. */
export function computePortraitLayout(input: LayoutInput): ColumnLayout {
  const frame = portraitFrame(input);
  const sizing = stackedSizing(frame) ?? compactSizing(frame);
  const used = FIXED + portraitLauncherHeight(sizing) + sizing.column;
  return {
    arrangement: "column",
    ...sizing,
    knob: Math.round(sizing.column * 0.37),
    stickWidth: Math.max(sizing.column, Math.min(LABEL_MIN, frame.content)),
    panel: frame.content,
    paddingH: frame.paddingH,
    paddingTop: frame.paddingTop,
    paddingBottom: frame.paddingBottom,
    spacer: Math.max(0, frame.room - used),
  };
}

/** The landscape row or the portrait column, whichever the window's shape calls for. */
export function computeDriveLayout(input: LayoutInput): DriveLayout {
  return chooseArrangement(input) === "column" ? computePortraitLayout(input) : computeLayout(input);
}
