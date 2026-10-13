// Every sign and origin the launcher UI guesses at, in one place, so one hardware test can correct them all.

export interface Assumptions {
  /** Off: +direction (the app's UI value) aims to the robot's right, seen from behind it. On: to its left. */
  flipDirection: boolean;
  /** Off: drill +x is the robot's right, seen from behind it. On: its left. */
  flipX: boolean;
  /** Where the robot stands on the drill z axis, in metres. The survey puts z = 0 at the robot-side baseline. */
  robotZ: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = { flipDirection: false, flipX: false, robotZ: 0 };

export const ASSUMPTION_NOTES = [
  "Direction −15..15 is the app's UI value, treated as degrees; + is drawn to the robot's right.",
  "Drill x is metres across the singles court, 0 = centre line; + is drawn to the robot's right.",
  "Drill z is metres of depth from the robot-side baseline; the net is drawn at 11.885 m.",
  "Spin + is drawn as topspin and − as slice.",
  "Height level 1..10 is sent as the app's apex metres (1.5..3.5 m).",
];

const STORAGE_KEY = "acemate.launcher.assumptions";

/** Negates a UI value when flipped; never returns −0, which would print as "-0". */
export function flipped(value: number, flip: boolean): number {
  return flip ? 0 - value || 0 : value;
}

export function parseAssumptions(raw: string | null): Assumptions {
  try {
    const stored = JSON.parse(raw ?? "{}") as Partial<Assumptions>;
    return {
      flipDirection: stored.flipDirection === true,
      flipX: stored.flipX === true,
      robotZ: Number.isFinite(stored.robotZ) ? Number(stored.robotZ) : DEFAULT_ASSUMPTIONS.robotZ,
    };
  } catch {
    return { ...DEFAULT_ASSUMPTIONS };
  }
}

export function loadAssumptions(storage: Pick<Storage, "getItem">): Assumptions {
  return parseAssumptions(storage.getItem(STORAGE_KEY));
}

export function saveAssumptions(storage: Pick<Storage, "setItem">, assumptions: Assumptions): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(assumptions));
}
