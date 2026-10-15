import type { FireMessage } from "@acemate/core";

/** The ball-machine fields the launcher panel and the aim keys edit. */
export interface Shot {
  direction: number;
  speed: number;
  spin: number;
  elevation: number;
  count: number;
  interval: number;
}

export const DEFAULT_SHOT: Shot = { direction: 0, speed: 5, spin: 0, elevation: 20, count: 1, interval: 4 };

function shotMessage(shot: Shot): FireMessage {
  return { kind: "machine", ...shot };
}

/** The drive screen's fire: always exactly one ball, whatever count the shot carries. */
export function singleBall(shot: Shot): FireMessage {
  return shotMessage({ ...shot, count: 1 });
}
