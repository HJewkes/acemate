import { spinStyle } from "@acemate/core";
import type { Shot } from "./shot";

/** A chip's label, and the short form every chip in the row switches to when one will not fit. */
export interface ChipLabel {
  label: string;
  short: string;
}

const SPIN_WORDS = { slice: "Slice", flat: "Flat", topspin: "Top" } as const;

/** "Flat", "Top 2", "Slice 3"; short "F", "T2", "S3". */
export function spinChip(spin: number): ChipLabel {
  const word = SPIN_WORDS[spinStyle(spin)];
  const amount = spin === 0 ? "" : String(Math.abs(spin));
  return { label: amount ? `${word} ${amount}` : word, short: `${word[0]}${amount}` };
}

/** "1 ball", or count × interval: "3 × 4 s", "3 × 1.5 s"; short "1", "3×4". */
export function ballsChip({ count, interval }: Pick<Shot, "count" | "interval">): ChipLabel {
  if (count === 1) return { label: "1 ball", short: "1" };
  return { label: `${count} × ${interval} s`, short: `${count}×${interval}` };
}

export function chipLabels(shot: Shot): { spin: ChipLabel; balls: ChipLabel } {
  return { spin: spinChip(shot.spin), balls: ballsChip(shot) };
}

/** The readout's note when one hold fires more than one ball, or "" for one ball. */
export function ballsNote({ count, interval }: Pick<Shot, "count" | "interval">): string {
  return count === 1 ? "" : `${count} balls / ${interval} s`;
}

/** Fire's hold prompt: the ball count is on the bar under the thumb whenever a hold fires more than one. */
export function holdPrompt(count: number): ChipLabel {
  if (count === 1) return { label: "HOLD TO FIRE", short: "FIRE" };
  return { label: `HOLD · ${count} BALLS`, short: `FIRE ×${count}` };
}
