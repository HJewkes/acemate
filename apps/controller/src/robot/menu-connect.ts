import type { LinkStatus } from "./use-robot";

/**
 * Where the app cannot connect by itself (the web, whose chooser needs a tap), opening the device menu with no robot
 * also opens the chooser from that same tap, so connecting takes one tap rather than two.
 */
export function connectsOnMenuOpen(status: LinkStatus, autoConnect: boolean): boolean {
  return !autoConnect && status === "disconnected";
}
