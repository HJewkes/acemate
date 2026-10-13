import { describe, expect, it } from "vitest";
import type { Request } from "../../drive-probe/src/protocol.js";
import { LaunchController, parseLaunch, setModeFor, type LaunchMessage } from "../src/launcher.js";

const single: LaunchMessage = { kind: "machine", direction: 0, speed: 3, spin: 0, elevation: 20, count: 1, interval: 1 };

function harness(options: { stopped?: boolean; ack?: boolean } = {}) {
  const sent: string[] = [];
  const reports: string[] = [];
  const controller = new LaunchController({
    send: async (request: Request) => void sent.push(request.type),
    waitFor: async () => (options.ack === false ? null : { type: "rsp_set_mode", data: { result: "ok" } }),
    driveStopped: () => options.stopped ?? true,
    report: (text) => void reports.push(text),
    now: () => 1000,
  });
  return { controller, sent, reports };
}

describe("parseLaunch", () => {
  it("accepts launch messages and ignores drive messages", () => {
    expect(parseLaunch('{"launch":{"kind":"stop"}}')).toEqual({ kind: "stop" });
    expect(parseLaunch('{"motion":"go_front"}')).toBeNull();
    expect(parseLaunch("not json")).toBeNull();
  });
});

describe("setModeFor", () => {
  it("builds the single-shot ball_machine payload the launch CLI uses", () => {
    expect(setModeFor(single as Extract<LaunchMessage, { kind: "machine" }>)).toMatchObject({
      type: "set_mode",
      data: { mode: "ball_machine", b: [[0, 3, 0, 20]], total_balls: 1 },
    });
  });

  it("puts a queue of distinct balls into one ordered ball_machine pass", () => {
    const balls = [
      { direction: 5, speed: 4, spin: 2, elevation: 30 },
      { direction: -10, speed: 7, spin: -1, elevation: 15 },
    ];

    expect(setModeFor({ kind: "machine-queue", balls, interval: 3.5 })).toMatchObject({
      data: { mode: "ball_machine", b: [[-5, 4, 2, 30], [10, 7, -1, 15]], total_balls: 2, interval: 3.5, random_order: false },
    });
  });
});

describe("LaunchController", () => {
  it("sends set_mode, waits for rsp_set_mode, then run_start", async () => {
    const { controller, sent } = harness();

    await controller.handle(single);

    expect(sent).toEqual(["set_mode", "run_start"]);
    expect(controller.running).toBe(true);
  });

  it("never sends run_start when the robot does not acknowledge set_mode", async () => {
    const { controller, sent, reports } = harness({ ack: false });

    await controller.handle(single);

    expect(sent).toEqual(["set_mode"]);
    expect(reports.at(-1)).toMatch(/not starting/);
  });

  it("refuses to fire while the robot is driving", async () => {
    const { controller, sent } = harness({ stopped: false });

    await controller.handle(single);

    expect(sent).toEqual([]);
  });

  it("rejects out-of-range parameters without sending anything", async () => {
    const { controller, sent, reports } = harness();

    await controller.handle({ ...single, speed: 11 });

    expect(sent).toEqual([]);
    expect(reports.at(-1)).toMatch(/Rejected/);
  });

  it("refuses a second run until the first is stopped", async () => {
    const { controller, sent } = harness();
    await controller.handle(single);

    await controller.handle(single);
    await controller.handle({ kind: "stop" });

    expect(sent).toEqual(["set_mode", "run_start", "run_stop"]);
    expect(controller.running).toBe(false);
  });

  it("clears the active run once the heartbeat shows it finished", async () => {
    const { controller } = harness();
    await controller.handle(single);

    controller.onCarState(false, 2000);
    controller.onCarState(true, 3000);
    controller.onCarState(false, 4000);

    expect(controller.running).toBe(false);
  });

  it("clears a run the robot never starts, so Fire works again", async () => {
    const { controller, reports } = harness();
    await controller.handle(single);

    controller.onCarState(false, 1000 + 7000);
    expect(controller.running).toBe(true);
    controller.onCarState(false, 1000 + 8000);

    expect(controller.running).toBe(false);
    expect(reports.at(-1)).toMatch(/did not start/);
  });
});
