import { describe, expect, it } from "vitest";
import { NO_RUN } from "../src/launcher/run-chip";
import { DEFAULT_SHOT } from "../src/launcher/shot";
import { liveReadout, type ReadoutRobot } from "../src/ui/readout";

const IDLE_ROBOT: ReadoutRobot = {
  status: "disconnected",
  detail: "",
  control: { motion: "stop", latched: false },
  launch: {
    battery: 80,
    robotRunning: false,
    runActive: false,
    inFlight: false,
    run: NO_RUN,
    log: [],
    reportedAt: 0,
  },
};

const read = (robot: ReadoutRobot, now = 0) =>
  Object.fromEntries(liveReadout(robot, DEFAULT_SHOT, now, false).map((row) => [row.label, row.value]));

describe("live readout", () => {
  it("hides a stale battery reading while the link is down", () => {
    expect(read(IDLE_ROBOT)).toMatchObject({ Link: "Not linked", Battery: "—", Run: "None" });
  });

  it("shows the robot, its battery and the motion going out while linked", () => {
    const robot = { ...IDLE_ROBOT, status: "connected" as const, detail: "ACEMATE-XXXXX" };

    const rows = read({ ...robot, control: { motion: "turn_left", latched: false } });

    expect(rows).toMatchObject({ Link: "Linked · ACEMATE-XXXXX", Battery: "80%", Motion: "turn left" });
  });

  it("says when an e-stop latch is holding the robot", () => {
    expect(read({ ...IDLE_ROBOT, control: { motion: "stop", latched: true } }).Motion).toBe(
      "stop (latched until released)",
    );
  });

  it("shows the aim and the shot the fire bar would send", () => {
    expect(read(IDLE_ROBOT)).toMatchObject({ Aim: "centre · elev 20°", Shot: "speed 5 · flat" });
  });

  it("times an active run from its start", () => {
    const launch = { ...IDLE_ROBOT.launch, runActive: true, run: { mode: "ball_machine", startedAt: 1_000 } };

    expect(read({ ...IDLE_ROBOT, launch }, 66_000).Run).toBe("Ball machine 01:05");
  });
});
