// Every sign and origin the launcher UI guesses at, in one place, so one hardware test can correct them all.

export interface Assumptions {
  /** Off: +direction (the app's UI value) aims to the robot's right, seen from behind it. On: to its left. */
  flipDirection: boolean;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = { flipDirection: false };

/** Negates a UI value when flipped; never returns −0, which would print as "-0". */
export function flipped(value: number, flip: boolean): number {
  return flip ? 0 - value || 0 : value;
}
