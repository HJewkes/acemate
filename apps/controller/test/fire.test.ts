import { describe, expect, it } from "vitest";
import { fireLock, type FireConditions } from "../src/launcher/fire-lock";
import { DEFAULT_SHOT, singleBall } from "../src/launcher/shot";
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

describe("drive screen fire", () => {
  it("sends one ball_machine ball with the aim pad's direction, speed, spin and elevation", async () => {
    const { session, sent } = harness(acceptsSetMode);
    const aimed = { ...DEFAULT_SHOT, direction: 7, speed: 9, spin: -2, elevation: 34, count: 5 };

    await session.launch.handle(singleBall(aimed));

    const setMode = sent.find(([, request]) => request.type === "set_mode")?.[1];
    // The wire direction is negated: + on the pad is the robot's right.
    expect(setMode?.data).toMatchObject({ mode: "ball_machine", b: [[-7, 9, -2, 34]], total_balls: 1 });
  });

  it("reports in flight from the fire until rsp_set_mode arrives", async () => {
    const { session } = harness(acceptsSetMode);

    const firing = session.launch.handle(singleBall(DEFAULT_SHOT));
    const during = session.launch.inFlight;
    await firing;
    await flush();

    expect(during).toBe(true);
    expect(session.launch.inFlight).toBe(false);
  });
});
