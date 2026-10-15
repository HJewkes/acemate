import type { Motion } from "./motion";

/** After an emergency stop, stay stopped until every input returns to neutral, so a held key can't restart the robot. */
export function applyStopLatch(latched: boolean, motion: Motion): { latched: boolean; motion: Motion } {
  if (!latched) return { latched, motion };
  return motion === "stop" ? { latched: false, motion } : { latched: true, motion: "stop" };
}
