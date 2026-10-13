import type { ProbeEnv } from "./probe";

/** The probe panel is web-only (?probe=1); native never shows it. */
export function requestedProbe(): ProbeEnv | null {
  return null;
}
