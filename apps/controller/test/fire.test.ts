import { describe, expect, it } from "vitest";
import { fireLock, type FireConditions } from "../src/launcher/fire-lock";
import { DEFAULT_SHOT, fireMessage, type Shot } from "../src/launcher/shot";
import { flush, harness, type Responder } from "./harness";

const END = "+==ACE==+";
const ready: FireConditions = { connected: true, motion: "stop", inFlight: false, runActive: false };
const acceptsSetMode: Responder = (request) =>
  request.type === "set_mode" ? JSON.stringify({ type: "rsp_set_mode", data: { result: 0 } }) + END : undefined;

describe("drive screen fire lock", () => {
  it("unlocks only when connected, stopped, idle and not running", () => {
    expect(fireLock(ready)).toBeNull();
  });

  it("locks while disconnected", () => {
    expect(fireLock({ ...ready, connected: false })).toBe("Not connected");
  });

  it("locks while the robot is moving, in any motion", () => {
    expect(fireLock({ ...ready, motion: "go_front" })).toBe("Stop driving to fire");
    expect(fireLock({ ...ready, motion: "turn_left" })).toBe("Stop driving to fire");
  });

  it("locks while a set_mode is in flight", () => {
    expect(fireLock({ ...ready, inFlight: true })).toBe("Waiting for the robot");
  });

  it("locks while a run is active", () => {
    expect(fireLock({ ...ready, runActive: true })).toBe("Run active");
  });
});

async function setModeFor(shot: Shot) {
  const { session, sent } = harness(acceptsSetMode);
  await session.launch.handle(fireMessage(shot));
  return sent.find(([, request]) => request.type === "set_mode")?.[1].data;
}

describe("drive screen fire", () => {
  it("sends one ball, as T-7 confirmed on hardware, when the Balls chip says 1", async () => {
    const aimed = { ...DEFAULT_SHOT, direction: 7, speed: 9, spin: -2, elevation: 34, count: 1, interval: 6 };

    // The wire direction is negated: + on the pad is the robot's right.
    expect(await setModeFor(aimed)).toEqual({
      mode: "ball_machine",
      interval: 1,
      b: [[-7, 9, -2, 34]],
      total_balls: 1,
      random_order: false,
      group_interval: 0,
      train_id: "drive_probe",
    });
  });

  it("repeats the one ball the chip's count of times, the chip's interval apart", async () => {
    const aimed = { ...DEFAULT_SHOT, direction: -4, speed: 3, spin: 2, elevation: 25, count: 3, interval: 4 };

    expect(await setModeFor(aimed)).toMatchObject({
      mode: "ball_machine",
      b: [[4, 3, 2, 25]],
      total_balls: 3,
      interval: 4,
    });
  });

  it("reports in flight from the fire until rsp_set_mode arrives", async () => {
    const { session } = harness(acceptsSetMode);

    const firing = session.launch.handle(fireMessage(DEFAULT_SHOT));
    const during = session.launch.inFlight;
    await firing;
    await flush();

    expect(during).toBe(true);
    expect(session.launch.inFlight).toBe(false);
  });
});
