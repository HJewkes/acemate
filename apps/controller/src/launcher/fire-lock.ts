import type { Motion } from "@acemate/core";
import type { RobotView } from "../robot/use-robot";

export interface FireConditions {
  connected: boolean;
  motion: Motion;
  /** A set_mode is waiting for rsp_set_mode. */
  inFlight: boolean;
  runActive: boolean;
}

/** Why the drive screen's Fire is locked, or null when it may fire. The first blocking reason wins. */
export function fireLock({ connected, motion, inFlight, runActive }: FireConditions): string | null {
  if (!connected) return "Not connected";
  if (motion !== "stop") return "Stop driving to fire";
  if (inFlight) return "Waiting for the robot";
  if (runActive) return "Run active";
  return null;
}

/** fireLock from what the drive screen knows about the robot. */
export function robotFireLock(robot: Pick<RobotView, "status" | "control" | "launch">): string | null {
  return fireLock({
    connected: robot.status === "connected",
    motion: robot.control.motion,
    inFlight: robot.launch.inFlight,
    runActive: robot.launch.runActive,
  });
}
