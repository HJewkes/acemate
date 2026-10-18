import { describe, expect, it } from "vitest";
import type { DriveInput } from "@acemate/core";
import { Controller } from "../src/control/controller";
import { flush, harness, type Sent } from "./harness";

const END = "+==ACE==+";
const runningHeartbeat = JSON.stringify({ type: "rsp_heartbeat", data: { car_state: { running: true } } }) + END;
const acceptsSetMode = (request: Sent) =>
  request.type === "set_mode" ? JSON.stringify({ type: "rsp_set_mode", data: { result: 0 } }) + END : undefined;
const oneBall = { kind: "machine", direction: 5, speed: 6, spin: 1, elevation: 20, count: 1, interval: 1 } as const;

// One word per request, so an ordering reads at a glance: "enter", "wheel drive_up 10", "wheel stop", "exit".
function label({ type, ...rest }: Sent): string {
  const { command, action, data } = rest as { command?: string; action?: string; data?: Record<string, unknown> };
  if (type === "motion_control") return `motion ${String(data?.motion)}`;
  if (command === "wheel_test")
    return action === "start" ? `wheel ${String(data?.direction)} ${String(data?.speed)}` : "wheel stop";
  if (type === "factory_test") return action === "start" ? "enter" : "exit";
  return type;
}

function advancedHarness(respond?: (request: Sent) => string | undefined) {
  const robot = harness(respond);
  const labels = () => robot.sent.map(([, request]) => label(request));
  const labelsAt = () => robot.sent.map(([at, request]) => [at, label(request)]);
  const steer = async (input: Partial<DriveInput>) => {
    robot.session.driveWheels({ x: 0, y: 0, turn: 0, ...input });
    await flush();
  };
  return { ...robot, labels, labelsAt, steer };
}

describe("wheel drive mode", () => {
  it("stops motion_control before entering factory mode, then drives the wheels at a graded speed", async () => {
    const { session, drive, steer, labels } = advancedHarness();
    await drive("go_front");

    session.setDriveMode("wheel");
    await steer({ y: 0.5 });
    await steer({ x: -1 });

    expect(labels()).toEqual([
      "ask_init_data",
      "motion go_front",
      "motion stop",
      "enter",
      "wheel drive_up 5",
      "wheel drive_left 10",
    ]);
  });

  it("sends no motion_control in wheel mode, whatever drive() is given", async () => {
    const { session, drive, advance, labels } = advancedHarness();
    session.setDriveMode("wheel");

    await drive("go_front");
    await advance(200);

    expect(labels().filter((line) => line.startsWith("motion"))).toEqual([]);
  });

  it("ignores the stick vector until wheel mode is on", async () => {
    const { steer, labels } = advancedHarness();

    await steer({ y: 1 });

    expect(labels()).toEqual(["ask_init_data"]);
  });

  it("resends a held stick every 100 ms and stops the wheels once input goes quiet for 500 ms", async () => {
    const { session, steer, advance, labelsAt } = advancedHarness();
    session.setDriveMode("wheel");
    await steer({ y: 1 });

    await advance(600);

    const wheel = labelsAt().filter(([, line]) => String(line).startsWith("wheel"));
    expect(wheel.slice(0, 5)).toEqual([
      [0, "wheel drive_up 10"],
      [100, "wheel drive_up 10"],
      [200, "wheel drive_up 10"],
      [300, "wheel drive_up 10"],
      [400, "wheel drive_up 10"],
    ]);
    expect(wheel[5]).toEqual([500, "wheel stop"]);
  });

  it("stops the wheels and exits factory mode when switched off, then drives motion_control again", async () => {
    const { session, steer, drive, labels } = advancedHarness();
    session.setDriveMode("wheel");
    await steer({ x: 1 });

    session.setDriveMode("stock");
    await drive("go_back");

    expect(labels().slice(-4)).toEqual(["wheel drive_right 10", "wheel stop", "exit", "motion go_back"]);
  });

  it("stops the wheels and exits factory mode on an emergency stop", async () => {
    const { session, steer, labels } = advancedHarness();
    session.setDriveMode("wheel");
    await steer({ y: -1 });

    session.emergencyStop();
    await flush();

    expect(labels().slice(-3, -1)).toEqual(["wheel stop", "exit"]);
    expect(session.driveMode).toBe("stock");
  });

  it("stops the wheels and exits factory mode before closing the link on shutdown", async () => {
    const { session, steer, labels, events } = advancedHarness();
    session.setDriveMode("wheel");
    await steer({ y: 1 });

    await session.shutdown();

    expect(labels().slice(-3)).toEqual(["wheel stop", "exit", "motion stop"]);
    expect(events).toEqual(["close"]);
  });

  it("holds the wheels during a launch run unless driving during runs is allowed", async () => {
    const held = advancedHarness(acceptsSetMode);
    await held.session.launch.handle(oneBall);
    held.notify(runningHeartbeat);
    await flush();
    held.session.setDriveMode("wheel");

    await held.steer({ y: 1 });
    held.session.allowDriveDuringRun = true;
    await held.steer({ x: 1 });

    expect(held.labels().filter((line) => line.startsWith("wheel drive"))).toEqual(["wheel drive_right 10"]);
  });

  it("refuses a new launch while the wheels are moving", async () => {
    const { session, steer, types } = advancedHarness(acceptsSetMode);
    session.setDriveMode("wheel");
    await steer({ y: 1 });

    await session.launch.handle(oneBall);

    expect(types()).not.toContain("set_mode");
  });
});

describe("controller stick vector", () => {
  it("combines sources by the stronger push per axis, in the horizontal mode's terms", () => {
    const controller = new Controller();
    controller.setStick({ x: 0.3, y: -0.9 });
    controller.setSource("keys", { forward: 0, side: -1, other: 0 });

    expect(controller.readVector()).toEqual({ x: -1, y: 0.9, turn: 0 });
  });

  it("reads zero while the emergency stop latch holds", () => {
    const controller = new Controller();
    controller.setStick({ x: 0, y: -1 });
    controller.emergencyStop();
    controller.read();

    expect(controller.readVector()).toEqual({ x: 0, y: 0, turn: 0 });
  });
});
