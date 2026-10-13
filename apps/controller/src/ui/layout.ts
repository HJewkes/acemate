export interface DriveLayout {
  /** Width of each side column: the thumbstick diameter and the launcher panel width. */
  column: number;
  knob: number;
  /** Horizontal screen padding: clears the Dynamic Island and rounded corners in landscape. */
  paddingH: number;
  /** Inward and downward nudges the owner asked for, scaled down on small screens. */
  nudgeX: number;
  nudgeY: number;
}

// The launcher stacks spin, speed, the square pad, a readout and the fire bar: about column + 164 pt tall.
const PANEL_CHROME = 164;
// Top bar, screen padding and a little breathing room above the bottom edge.
const VERTICAL_RESERVE = 76;
const CENTRE_MIN = 200;
const COLUMN_MIN = 130;
const COLUMN_MAX = 260;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Sizes both side columns from the window so the screen fits any landscape phone or tablet. */
export function computeLayout({ width, height }: { width: number; height: number }): DriveLayout {
  const paddingH = width >= 700 ? 56 : 20;
  const byHeight = height - VERTICAL_RESERVE - PANEL_CHROME;
  const byWidth = (width - 2 * paddingH - CENTRE_MIN) / 2;
  const column = Math.floor(clamp(Math.min(byHeight, byWidth), COLUMN_MIN, COLUMN_MAX));
  const slack = width - 2 * paddingH - 2 * column - CENTRE_MIN;
  return {
    column,
    knob: Math.round(column * 0.37),
    paddingH,
    nudgeX: Math.round(clamp(slack / 6, 0, 28)),
    nudgeY: column >= 180 ? 20 : 8,
  };
}
