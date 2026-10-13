import type { FireMessage } from "@acemate/core";

/** The ball-machine fields both A (Controls) and C (Aim pad) edit; each layout keeps its own copy. */
export interface Shot {
  direction: number;
  speed: number;
  spin: number;
  elevation: number;
  count: number;
  interval: number;
}

// The web launcher's starting shot, so both controllers open on the same ball.
export const DEFAULT_SHOT: Shot = { direction: 0, speed: 5, spin: 0, elevation: 20, count: 1, interval: 4 };

export function shotMessage(shot: Shot): FireMessage {
  return { kind: "machine", ...shot };
}

/** The drive screen's fire: always exactly one ball, whatever count the shot carries. */
export function singleBall(shot: Shot): FireMessage {
  return shotMessage({ ...shot, count: 1 });
}
