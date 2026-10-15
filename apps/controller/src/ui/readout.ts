import { directionLabel, spinLabel } from "@acemate/core";
import { ballsNote } from "../launcher/chips";
import { runChip } from "../launcher/run-chip";
import type { Shot } from "../launcher/shot";
import type { RobotView } from "../robot/use-robot";

interface ReadoutRow {
  label: string;
  value: string;
}

export type ReadoutRobot = Pick<RobotView, "status" | "detail" | "control" | "launch">;

const LINK_TEXT: Record<RobotView["status"], string> = {
  connected: "Linked",
  scanning: "Scanning",
  connecting: "Connecting",
  disconnected: "Not linked",
};
const NONE = "—";

function linkText({ status, detail }: ReadoutRobot): string {
  return status === "connected" && detail ? `${LINK_TEXT[status]} · ${detail}` : LINK_TEXT[status];
}

function motionText({ control }: ReadoutRobot): string {
  const motion = control.motion.replace(/_/g, " ");
  return control.latched ? `${motion} (latched until released)` : motion;
}

function runText({ launch }: ReadoutRobot, now: number): string {
  const chip = runChip({ runActive: launch.runActive, inFlight: launch.inFlight, run: launch.run, now });
  if (chip) return `${chip.mode} ${chip.elapsed}`;
  return launch.robotRunning ? "Robot reports running" : "None";
}

/** The side panel's live state: what the link, the drive loop, the aim and any run are doing right now. */
export function liveReadout(robot: ReadoutRobot, shot: Shot, now: number, flipDirection: boolean): ReadoutRow[] {
  const battery = robot.status === "connected" ? robot.launch.battery : null;
  return [
    { label: "Link", value: linkText(robot) },
    { label: "Motion", value: motionText(robot) },
    { label: "Aim", value: `${directionLabel(shot.direction, flipDirection)} · elev ${shot.elevation}°` },
    {
      label: "Shot",
      value: [`speed ${shot.speed}`, spinLabel(shot.spin), ballsNote(shot)].filter(Boolean).join(" · "),
    },
    { label: "Run", value: runText(robot, now) },
    { label: "Battery", value: battery === null ? NONE : `${battery}%` },
  ];
}
