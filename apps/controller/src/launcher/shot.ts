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

/** The drive screen's fire: the Balls chip's count of this ball, `interval` seconds apart. */
export function fireMessage(shot: Shot): FireMessage {
  return { kind: "machine", ...shot };
}
