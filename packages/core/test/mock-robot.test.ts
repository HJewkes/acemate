import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LineDecoder, lineText, requests, type Request } from "../src/protocol/protocol";
import { MockRobot, robotLine } from "../src/mock/mock-robot";

function robotWithInbox() {
  const inbox: Request[] = [];
  const robot = new MockRobot((message) => inbox.push(message));
  const send = (request: Request) => robot.receive(lineText(request));
  const types = () => inbox.map((message) => message.type);
  return { robot, inbox, send, types };
}

const setMode = (balls: number, interval: number): Request => ({
  type: "set_mode",
  data: { mode: "ball_machine", total_balls: balls, interval },
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("MockRobot replies", () => {
  it("answers init and heartbeat after a short delay", () => {
    const { send, types } = robotWithInbox();

    send(requests.askInit());
    send(requests.heartbeat());
    const before = types();
    vi.advanceTimersByTime(30);

    expect(before).toEqual([]);
    expect(types()).toEqual(["rsp_init_data", "rsp_heartbeat"]);
  });

  it("reports the clock as unset until set_time arrives", () => {
    const { robot, send } = robotWithInbox();

    const before = robot.state.time_is_set;
    send({ type: "set_time", data: { unix_timestamp: 1 } });

    expect(before).toBe(false);
    expect(robot.state.time_is_set).toBe(true);
  });

  it("ignores a write that is only part of a message, as the robot does with chunked writes", () => {
    const { robot, inbox } = robotWithInbox();

    robot.receive('{"type":"ask_heart');
    vi.advanceTimersByTime(100);

    expect(robot.received).toEqual([]);
    expect(inbox).toEqual([]);
  });
});

describe("MockRobot runs", () => {
  it("acks set_mode but ignores run_start while the clock is unset", () => {
    const { robot, send, types } = robotWithInbox();

    send(setMode(1, 1));
    send({ type: "run_start" });
    vi.advanceTimersByTime(5000);

    expect(types()).toEqual(["rsp_set_mode"]);
    expect(robot.state.running).toBe(false);
  });

  it("runs for balls times interval seconds once the clock is set, then pushes run_stop", () => {
    const { robot, inbox, send, types } = robotWithInbox();
    send({ type: "set_time", data: {} });
    send(setMode(3, 2));

    send({ type: "run_start" });
    vi.advanceTimersByTime(5999);
    const midRun = robot.state.running;
    vi.advanceTimersByTime(1);

    expect(midRun).toBe(true);
    expect(robot.state.running).toBe(false);
    expect(types()).toEqual(["rsp_set_time", "rsp_set_mode", "run_start", "run_stop"]);
    expect(inbox.at(-1)).toEqual({ type: "run_stop", reason: "ball_machine_finished" });
  });

  it("stops a run early on run_stop without pushing ball_machine_finished", () => {
    const { robot, send, types } = robotWithInbox();
    send({ type: "set_time", data: {} });
    send(setMode(10, 1));
    send({ type: "run_start" });

    send({ type: "run_stop" });
    vi.advanceTimersByTime(20_000);

    expect(robot.state.running).toBe(false);
    expect(types()).not.toContain("run_stop");
  });
});

describe("robotLine", () => {
  it("ends with the marker LineDecoder splits on", () => {
    const decoder = new LineDecoder();

    const lines = decoder.push(Buffer.from(robotLine({ type: "rsp_heartbeat" })));

    expect(lines).toEqual(['{"type":"rsp_heartbeat"}']);
  });
});

describe("MockRobot factory test", () => {
  const wheelStart = {
    type: "factory_test",
    command: "wheel_test",
    action: "start",
    data: { direction: "drive_left", speed: 3 },
  };

  it("ignores wheel_test until factory mode is entered", () => {
    const { robot, send, types } = robotWithInbox();

    send(wheelStart);
    vi.advanceTimersByTime(100);

    expect(robot.factoryState.wheels).toBeNull();
    expect(types()).toEqual([]);
  });

  it("drives the wheels for one 500 ms frame per wheel_test start", () => {
    const { robot, send } = robotWithInbox();
    send({ type: "factory_test", action: "start" });

    send(wheelStart);
    vi.advanceTimersByTime(499);
    const during = robot.factoryState.wheels;
    vi.advanceTimersByTime(1);

    expect(during).toEqual({ direction: "drive_left", speed: 3 });
    expect(robot.factoryState.wheels).toBeNull();
  });

  it("stops the wheels on wheel_test stop and on leaving factory mode", () => {
    const { robot, send } = robotWithInbox();
    send({ type: "factory_test", action: "start" });
    send(wheelStart);

    send({ type: "factory_test", command: "wheel_test", action: "stop" });
    const afterStop = robot.factoryState.wheels;
    send(wheelStart);
    send({ type: "factory_test", action: "stop" });

    expect(afterStop).toBeNull();
    expect(robot.factoryState).toEqual({ factoryMode: false, wheels: null });
  });
});
