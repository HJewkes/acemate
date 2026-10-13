export interface Size {
  width: number;
  height: number;
}

export type Pointer = "fine" | "coarse";

/** "phone" fills the window with the drive screen; "framed" shows it in a phone-sized frame beside a side panel. */
export type WebShell = { mode: "phone" } | { mode: "framed"; frame: Size; panel: number };

export const SIDE_PANEL = 320;
/** Page margin, and the gap between the frame and the panel. */
export const SHELL_MARGIN = 24;
/** The frame's bezel, outside the drive screen's own size. */
export const BEZEL = 10;
// The iPhone 17 Pro Max in landscape, where the owner tuned the drive screen.
const PHONE: Size = { width: 956, height: 440 };
// Below this the launcher no longer fits under computeLayout's column minimum, so the full-window layout wins.
export const MIN_FRAME_HEIGHT = 374;

const PHONE_SHELL: WebShell = { mode: "phone" };

/** Frames the drive screen only for a mouse or trackpad with room for a usable frame plus the side panel. */
export function computeWebShell({ width, height, pointer }: Size & { pointer: Pointer }): WebShell {
  if (pointer === "coarse") return PHONE_SHELL;
  const roomWidth = width - SIDE_PANEL - 3 * SHELL_MARGIN - 2 * BEZEL;
  const roomHeight = height - 2 * SHELL_MARGIN - 2 * BEZEL;
  const frameHeight = Math.floor(Math.min(PHONE.height, roomHeight, (roomWidth * PHONE.height) / PHONE.width));
  if (frameHeight < MIN_FRAME_HEIGHT) return PHONE_SHELL;
  const frame = { width: Math.floor((frameHeight * PHONE.width) / PHONE.height), height: frameHeight };
  return { mode: "framed", frame, panel: SIDE_PANEL };
}
