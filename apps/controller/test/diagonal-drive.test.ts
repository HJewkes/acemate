import { describe, expect, it } from "vitest";
import { Controller } from "../src/control/controller";
import { flush, harness, type Sent } from "./harness";

const END = "+==ACE==+";
const runningHeartbeat = JSON.stringify({ type: "rsp_heartbeat", data: { car_state: { running: true } } }) + END;
const acceptsSetMode = (request: Sent) =>
  request.type === "set_mode" ? JSON.stringify({ type: "rsp_set_mode", data: { result: 0 } }) + END : undefined;
const oneBall = { kind: "machine", direction: 5, speed: 6, spin: 1, elevation: 20, count: 1, interval: 1 } as const;

type MotionData = { motion: string; speed?: number; shot_switch: string };

function diagonalHarness(respond?: (request: Sent) => string | undefined) {
  const robot = harness(respond);
  const frames = () => robot.motions().map(([at, request]) => [at, request.data as MotionData] as const);
  const steer = async (motion: Parameters<typeof robot.session.driveDiagonal>[0], speed: number) => {
    robot.session.driveDiagonal(motion, speed);
    await flush();
  };
  return { ...robot, frames, steer };
}

describe("diagonal drive mode", () => {
  it("sends a diagonal with its speed at once and every 50 ms, with the launcher off", async () => {
    const { session, steer, advance, frames } = diagonalHarness();
    session.setDriveMode("diagonal");

    await steer("go_front_left", 4);
    await advance(100);
    await steer("go_front_left", 4);

    expect(frames().slice(0, 3)).toEqual([
      [0, { motion: "go_front_left", speed: 4, shot_switch: "off" }],
      [50, { motion: "go_front_left", speed: 4, shot_switch: "off" }],
      [100, { motion: "go_front_left", speed: 4, shot_switch: "off" }],
    ]);
  });

  it("sends a new speed on the next resend while the direction holds", async () => {
    const { session, steer, advance, frames } = diagonalHarness();
    session.setDriveMode("diagonal");
    await steer("go_back", 2);

    await steer("go_back", 5);
    await advance(50);

    expect(frames().map(([, data]) => data.speed)).toEqual([2, 5]);
  });

  it("stops with the stock stop frame once input goes quiet for 300 ms", async () => {
    const { session, steer, advance, frames } = diagonalHarness();
    session.setDriveMode("diagonal");
    await steer("go_back_right", 3);

    await advance(400);

    const stops = frames().filter(([, data]) => data.motion === "stop");
    expect(stops[0]).toEqual([300, { motion: "stop", shot_switch: "off" }]);
  });

  it("keeps shot_switch off on every frame across modes and stops", async () => {
    const { session, drive, steer, advance, frames } = diagonalHarness();
    await drive("go_front");
    session.setDriveMode("diagonal");
    await steer("go_front_right", 5);
    await advance(200);
    session.emergencyStop();
    await flush();

    expect(frames().length).toBeGreaterThan(4);
    expect(frames().every(([, data]) => data.shot_switch === "off")).toBe(true);
  });

  it("stops the stock motion before switching, and ignores drive() while diagonal", async () => {
    const { session, drive, steer, frames } = diagonalHarness();
    await drive("go_front");

    session.setDriveMode("diagonal");
    await drive("go_left");
    await steer("go_back_left", 1);

    expect(frames().map(([, data]) => data.motion)).toEqual(["go_front", "stop", "go_back_left"]);
  });

  it("ignores driveDiagonal in stock mode, which never sends a speed", async () => {
    const { steer, drive, frames } = diagonalHarness();

    await steer("go_front_left", 5);
    await drive("go_front");

    expect(frames().map(([, data]) => data)).toEqual([{ motion: "go_front", shot_switch: "off" }]);
  });

  it("enters factory mode only when switched to wheel, stopping the motion first", async () => {
    const { session, steer, types, frames } = diagonalHarness();
    session.setDriveMode("diagonal");
    await steer("go_front_right", 3);
    expect(types()).not.toContain("factory_test");

    session.setDriveMode("wheel");
    await flush();

    expect(frames().at(-1)?.[1]).toEqual({ motion: "stop", shot_switch: "off" });
    expect(types().at(-1)).toBe("factory_test");
    expect(session.driveMode).toBe("wheel");
  });

  it("holds at stop during a launch run unless driving during runs is allowed", async () => {
    const held = diagonalHarness(acceptsSetMode);
    await held.session.launch.handle(oneBall);
    held.notify(runningHeartbeat);
    await flush();
    held.session.setDriveMode("diagonal");

    await held.steer("go_front_left", 2);
    held.session.allowDriveDuringRun = true;
    await held.steer("go_back_right", 2);

    expect(held.frames().map(([, data]) => data.motion)).toEqual(["go_back_right"]);
  });
});

describe("controller diagonal read", () => {
  it("resolves eight directions with a speed, while the stock read stays on four", () => {
    const controller = new Controller();
    controller.setStick({ x: -0.5, y: -0.5 });

    expect(controller.read(true)).toEqual({ motion: "go_front_left", latched: false, speed: 4 });
    expect(controller.read()).toEqual({ motion: "go_front", latched: false });
  });

  it("reads stop while the emergency stop latch holds", () => {
    const controller = new Controller();
    controller.setStick({ x: 0.7, y: -0.7 });
    controller.emergencyStop();

    expect(controller.read(true).motion).toBe("stop");
  });
});
