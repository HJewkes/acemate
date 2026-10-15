import { describe, expect, it } from "vitest";
import type { Request } from "../src/protocol/protocol";
import { LaunchController, parseLaunch, setModeFor, type LaunchMessage } from "../src/launch/launch-controller";

const single: LaunchMessage = {
  kind: "machine",
  direction: 0,
  speed: 3,
  spin: 0,
  elevation: 20,
  count: 1,
  interval: 1,
};

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

// rsp_set_mode arrives only when the test calls answer(), so a fire can be held in flight.
function pendingHarness() {
  const sent: string[] = [];
  const reports: string[] = [];
  let answer: (reply: Request | null) => void = () => undefined;
  const controller = new LaunchController({
    send: async (request: Request) => void sent.push(request.type),
    waitFor: () => new Promise((resolve) => (answer = resolve)),
    driveStopped: () => true,
    report: (text) => void reports.push(text),
    now: () => 1000,
  });
  // Lets the set_mode write land and the wait begin before answering.
  const ack = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    answer({ type: "rsp_set_mode", data: { result: "ok" } });
  };
  return { controller, sent, reports, ack };
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
      data: {
        mode: "ball_machine",
        b: [
          [-5, 4, 2, 30],
          [10, 7, -1, 15],
        ],
        total_balls: 2,
        interval: 3.5,
        random_order: false,
      },
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

describe("LaunchController with run_start and run_stop pushes", () => {
  it("ends the run as soon as the robot pushes run_stop", async () => {
    const { controller, reports } = harness();
    await controller.handle(single);

    controller.onRunStart(1_700_000_000);
    controller.onRunStop("ball_machine_finished", 1_700_000_001);

    expect(controller.running).toBe(false);
    expect(reports.at(-1)).toBe("Run finished (run_stop ball_machine_finished)");
  });

  it("keeps the run after its run_start push when a heartbeat still says running:false", async () => {
    const { controller } = harness();
    await controller.handle(single);

    controller.onRunStart(1_700_000_000);
    controller.onCarState(false, 2000);

    expect(controller.running).toBe(true);
  });

  it("clears a pushed-start run whose run_stop never arrives once running stays false past the timeout", async () => {
    const { controller, reports } = harness();
    await controller.handle(single);
    controller.onRunStart(1_700_000_000);

    controller.onCarState(false, 1000 + 8000);

    expect(controller.running).toBe(false);
    expect(reports.at(-1)).toMatch(/without a run_stop push/);
  });

  it("ignores a run_stop that arrives before this run's run_start push, as it belongs to an older run", async () => {
    const { controller } = harness();
    await controller.handle(single);

    controller.onRunStop("ball_machine_finished", undefined);

    expect(controller.running).toBe(true);
  });

  it("ignores a run_stop whose end_time is before this run's start_time", async () => {
    const { controller } = harness();
    await controller.handle(single);
    controller.onRunStart(1_700_000_100);

    controller.onRunStop("ball_machine_finished", 1_700_000_050);

    expect(controller.running).toBe(true);
  });

  it("ignores a run_stop that arrives while the next set_mode awaits its reply", async () => {
    const { controller, ack } = pendingHarness();

    const firing = controller.handle(single);
    controller.onRunStop("ball_machine_finished", undefined);
    await ack();
    await firing;

    expect(controller.running).toBe(true);
  });

  it("accepts a run_stop without a run_start push once a heartbeat showed the run going", async () => {
    const { controller } = harness();
    await controller.handle(single);

    controller.onCarState(true, 2000);
    controller.onRunStop("ball_machine_finished", undefined);

    expect(controller.running).toBe(false);
  });

  it("still reports a run the robot never starts when no push arrives", async () => {
    const { controller, reports } = harness();
    await controller.handle(single);

    controller.onRunStart(1_700_000_000);
    await controller.handle({ kind: "stop" });
    await controller.handle(single);
    controller.onCarState(false, 1000 + 8000);

    expect(reports.at(-1)).toMatch(/did not start/);
  });
});

describe("LaunchController while set_mode is in flight", () => {
  it("sends one set_mode when a second fire arrives before rsp_set_mode, and refuses the second", async () => {
    const { controller, sent, reports, ack } = pendingHarness();

    const first = controller.handle(single);
    const second = controller.handle(single);
    await second;
    await ack();
    await first;

    expect(sent).toEqual(["set_mode", "run_start"]);
    expect(reports[0]).toBe("Still waiting for the last launch; try again.");
  });

  it("reports in flight until the reply, and may be running from set_mode on", async () => {
    const { controller, ack } = pendingHarness();

    const firing = controller.handle(single);
    const during = { inFlight: controller.inFlight, mayBeRunning: controller.mayBeRunning };
    await ack();
    await firing;

    expect(during).toEqual({ inFlight: true, mayBeRunning: true });
    expect({ inFlight: controller.inFlight, mayBeRunning: controller.mayBeRunning }).toEqual({
      inFlight: false,
      mayBeRunning: true,
    });
  });

  it("never starts the run when stop arrives before rsp_set_mode", async () => {
    const { controller, sent, reports, ack } = pendingHarness();

    const firing = controller.handle(single);
    await controller.handle({ kind: "stop" });
    await ack();
    await firing;

    expect(sent).toEqual(["set_mode", "run_stop"]);
    expect(controller.mayBeRunning).toBe(false);
    expect(reports.at(-1)).toBe("Stopped before the run started; not starting.");
  });

  it("allows a new fire once a failed set_mode write clears the wait", async () => {
    let failNext = true;
    const controller = new LaunchController({
      send: async () => {
        if (failNext) throw new Error("write failed");
      },
      waitFor: async () => ({ type: "rsp_set_mode" }),
      driveStopped: () => true,
      report: () => undefined,
      now: () => 1000,
    });
    await controller.handle(single).catch(() => undefined);
    failNext = false;

    await controller.handle(single);

    expect(controller.running).toBe(true);
  });
});
