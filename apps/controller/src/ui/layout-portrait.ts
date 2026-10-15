import {
  CHIP_ROW,
  LABEL_MIN,
  NO_INSETS,
  PANEL_INSET,
  STICK_SWITCH,
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
/** The stacked launcher's height less its pad: the chip row, speed, a two-line readout, Fire, padding and gaps. */
const STACKED_CHROME = CHIP_ROW + 157;
/** Space between Fire and the Strafe / Turn switch, so a thumb on the switch is well clear of Fire. */
export const FIRE_GUARD = 16;
// The stick and pad stay near the owner-tuned landscape stick (200), and the pad no larger than is useful.
const STICK_MAX = 220;
const PAD_MAX = 260;
// Under this, the stacked stick or pad is too small and the pad moves beside the controls.
const STACKED_MIN = 150;
const STICK_MIN = 110;
const PAD_MIN = 110;
// The stick never takes more than this share of the width, leaving the thumb room around it.
const STICK_WIDTH_SHARE = 0.6;
/**
 * The shortest portrait window, in points, whose stack still fits for widths 360-440. Below it the stick is held at
 * STICK_MIN and the stack overflows. The wide launcher grows with width, so 360 and 375 fit down to 426 and 393 to 443.
 */
export const PORTRAIT_MIN_HEIGHT = 490;
/** The wordmark's line height; it shows only when the spare height can hold it. */
export const WORDMARK_HEIGHT = 24;
// The share of the slack kept around the wordmark; the rest goes under the stick (owner: 70% less around the logo).
const AROUND_WORDMARK = 0.3;
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

/** For short windows: the pad beside the chips, speed, readout and Fire, as in landscape's wide launcher. */
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
    ...splitSpare(Math.max(0, frame.room - used)),
  };
}

/** The wordmark keeps 30% of the slack around it, top and bottom; the other 70% sits under the stick. */
function splitSpare(spare: number): Pick<ColumnLayout, "wordmark" | "spacerTop" | "spacerBottom"> {
  const wordmark = spare >= WORDMARK_HEIGHT;
  const slack = wordmark ? spare - WORDMARK_HEIGHT : spare;
  const around = Math.floor(slack * AROUND_WORDMARK);
  return { wordmark, spacerTop: around + (wordmark ? WORDMARK_HEIGHT : 0), spacerBottom: slack - around };
}

/** The landscape row or the portrait column, whichever the window's shape calls for. */
export function computeDriveLayout(input: LayoutInput): DriveLayout {
  return chooseArrangement(input) === "column" ? computePortraitLayout(input) : computeLayout(input);
}
