/** "stacked" puts the aim pad between speed and Fire; "wide" puts it beside them, for screens short on height. */
export type LauncherShape = "stacked" | "wide";

export interface DriveLayout {
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
  /** Horizontal screen padding: clears the Dynamic Island and rounded corners in landscape. */
  paddingH: number;
  /** Inward and downward nudges the owner asked for, scaled down on small screens. */
  nudgeX: number;
  nudgeY: number;
}

export interface LayoutInput {
  width: number;
  height: number;
  /**
   * True when the screen runs under a notch or Dynamic Island: the native app, or the laptop frame that mimics it.
   * A browser keeps the page clear of those itself, so the page needs only a small margin.
   */
  inset?: boolean;
}

// The launcher stacks spin, speed, the square pad, a readout and the fire bar: about column + 164 pt tall.
const PANEL_CHROME = 164;
// Top bar, screen padding and a little breathing room above the bottom edge.
const VERTICAL_RESERVE = 76;
const CENTRE_MIN = 200;
const COLUMN_MIN = 130;
const COLUMN_MAX = 260;
// Narrower than this, "↔ Strafe" and the spin labels truncate (web has no shrink-to-fit text).
const LABEL_MIN = 180;
/** Inner padding plus border of the launcher panel, on each side. */
export const PANEL_INSET = 12;
/** In the wide launcher, the column of spin, speed, readout and Fire beside the pad, and its gap to the pad. */
export const WIDE_SIDE = 160;
export const WIDE_GAP = 10;
// Below this stacked size the pad and labels get cramped, so a short, wide screen moves the pad beside the controls.
const WIDE_BELOW = 170;
// The Strafe / Turn switch and its gap above the stick.
const STICK_SWITCH = 50;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The stick size each launcher shape allows: stacked is bound by height, wide by width. */
function candidateColumns(height: number, sides: number): { stacked: number; wide: number } {
  const room = height - VERTICAL_RESERVE;
  const size = (value: number) => Math.floor(clamp(value, COLUMN_MIN, COLUMN_MAX));
  const wideRoom = sides - WIDE_SIDE - WIDE_GAP - 2 * PANEL_INSET;
  return {
    stacked: size(Math.min(room - PANEL_CHROME, sides / 2)),
    // The pad and stick share what the wide panel's chrome leaves; the stick column never drops below LABEL_MIN.
    wide: size(Math.min(room - 2 * PANEL_INSET, room - STICK_SWITCH, wideRoom / 2, wideRoom - LABEL_MIN)),
  };
}

/** The launcher panel's height for a layout, from its pad and chrome. */
export function launcherHeight(layout: Pick<DriveLayout, "launcher" | "column" | "pad">): number {
  return layout.launcher === "wide" ? layout.pad + 2 * PANEL_INSET : layout.column + PANEL_CHROME;
}

/** Sizes the stick and launcher from the window so the screen fits any landscape phone, tablet or browser. */
export function computeLayout({ width, height, inset = true }: LayoutInput): DriveLayout {
  const paddingH = !inset ? 20 : width >= 700 ? 56 : 20;
  const sides = width - 2 * paddingH - CENTRE_MIN;

  const { stacked, wide } = candidateColumns(height, sides);
  const launcher: LauncherShape = stacked < WIDE_BELOW && wide > stacked ? "wide" : "stacked";
  const column = launcher === "wide" ? wide : stacked;
  const labelMin = Math.min(LABEL_MIN, Math.floor(sides / 2));
  const stickWidth = Math.max(column, labelMin);
  const panel = launcher === "wide" ? column + WIDE_SIDE + WIDE_GAP + 2 * PANEL_INSET : Math.max(column, labelMin);
  // The stacked pad keeps its historic size, the column less the panel's padding.
  const pad = launcher === "wide" ? column : column - 20;
  const slack = sides - stickWidth - panel;
  return {
    column,
    knob: Math.round(column * 0.37),
    stickWidth,
    launcher,
    panel,
    pad,
    paddingH,
    nudgeX: Math.round(clamp(slack / 6, 0, 28)),
    nudgeY: column >= 180 ? 20 : 8,
  };
}
