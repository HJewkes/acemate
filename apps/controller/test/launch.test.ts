import { describe, expect, it } from "vitest";
import { devLog } from "../src/debug/log-buffer";
import { SET_TIME_EVERY_MS } from "../src/robot/launch-link";
import { flush, harness, type Responder } from "./harness";

const END = "+==ACE==+";
const heartbeat = (carState: Record<string, unknown>) => JSON.stringify({ type: "rsp_heartbeat", data: { car_state: carState } }) + END;
const acceptsSetMode: Responder = (request) =>
  request.type === "set_mode" ? JSON.stringify({ type: "rsp_set_mode", data: { result: 0 } }) + END : undefined;
const oneBall = { kind: "machine", direction: 5, speed: 6, spin: 1, elevation: 20, count: 1, interval: 1 } as const;
// A drill set_mode is ~335 bytes, past one unacked packet; a one-ball ball_machine set_mode is ~164.
const targetShot = { kind: "target", x: 3.2, z: 21, heightLevel: 4, spin: 1 } as const;

function launchHarness(respond: Responder = acceptsSetMode) {
  const robot = harness(respond);
  const reports: string[] = [];
  robot.session.launch.listen({ report: (text) => reports.push(text), carState: () => undefined });
  return { ...robot, reports };
}

describe("robot clock", () => {
  it("sends set_time when a heartbeat says the clock is unset", async () => {
    const { notify, sent, jump } = harness();
    jump(1_700_000_000_000);

    notify(heartbeat({ running: false, time_is_set: false }));
    await flush();

    const setTime = sent.find(([, r]) => r.type === "set_time")?.[1];
    expect(setTime?.data).toMatchObject({ unix_timestamp: 1_700_000_000, country_code: "US" });
  });

  it("sends set_time at most once per 30 s while the clock stays unset", async () => {
    const { notify, types, jump } = harness();
    const unset = heartbeat({ running: false, time_is_set: false });

    notify(unset);
    jump(SET_TIME_EVERY_MS - 1);
    notify(unset);
    jump(1);
    notify(unset);
    await flush();

    expect(types().filter((type) => type === "set_time")).toHaveLength(2);
  });

  it("does not send set_time once the clock is set", async () => {
    const { notify, types } = harness();

    notify(heartbeat({ running: false, time_is_set: true }));
    await flush();

    expect(types()).not.toContain("set_time");
  });
});

describe("launch", () => {
  it("fires a long set_mode with response, waits for rsp_set_mode, then run_start without response", async () => {
    const { session, modes, reports } = launchHarness();

    await session.launch.handle(targetShot);

    expect(modes.slice(1)).toEqual([
      ["set_mode", true],
      ["run_start", false],
    ]);
    expect(reports.at(-1)).toBe("run_start sent");
    expect(session.launch.running).toBe(true);
  });

  it("sends a one-ball set_mode unacked, since it fits one packet", async () => {
    const { session, modes } = launchHarness();

    await session.launch.handle(oneBall);

    expect(modes.slice(1, 2)).toEqual([["set_mode", false]]);
  });

  it("does not start the run when the robot never answers set_mode", async () => {
    const { session, types, reports } = launchHarness(() => undefined);

    await session.launch.handle(oneBall);

    expect(types()).not.toContain("run_start");
    expect(reports).toEqual(["No rsp_set_mode within 3 s; not starting."]);
  }, 5000);

  it("sends one set_mode when a second fire arrives before the robot answers the first", async () => {
    const { session, types, reports } = launchHarness();

    await Promise.all([session.launch.handle(oneBall), session.launch.handle(oneBall)]);

    expect(types().filter((type) => type === "set_mode")).toHaveLength(1);
    expect(reports[0]).toBe("Still waiting for the last launch; try again.");
  });

  it("sends stop, then run_stop, then closes when shut down mid-run", async () => {
    const { session, timeline } = launchHarness();
    await session.launch.handle(oneBall);

    await session.shutdown();

    expect(timeline.slice(-4)).toEqual(["run_start", "motion:stop", "run_stop", "close"]);
  });

  it("sends run_stop on shutdown while set_mode waits for its reply, and never starts the run", async () => {
    const { session, timeline } = launchHarness(() => undefined);
    const firing = session.launch.handle(oneBall);
    await flush();

    await session.shutdown();
    session.launch.onMessage({ type: "rsp_set_mode", data: { result: 0 } });
    await firing;

    expect(timeline.slice(1)).toEqual(["set_mode", "motion:stop", "run_stop", "close"]);
  });

  it("refuses to fire while the robot is driving", async () => {
    const { session, drive, types, reports } = launchHarness();
    await drive("go_front");

    await session.launch.handle(oneBall);

    expect(types()).not.toContain("set_mode");
    expect(reports).toEqual(["Stop driving before launching."]);
  });

  it("tracks the run from heartbeats and holds driving at stop until it ends", async () => {
    const { session, notify, drive, motions, reports } = launchHarness();
    await session.launch.handle(oneBall);

    notify(heartbeat({ running: true }));
    await drive("go_front");
    const heldAtStop = motions().every(([, r]) => (r.data as { motion: string }).motion === "stop");
    notify(heartbeat({ running: false }));
    await flush();

    expect(heldAtStop).toBe(true);
    expect(session.launch.running).toBe(false);
    expect(reports.at(-1)).toBe("Run finished (heartbeat running:false)");
  });
});

describe("driving during a run", () => {
  const sentMotions = (motions: () => [number, { data?: unknown }][]) =>
    motions().map(([, r]) => (r.data as { motion: string }).motion);

  async function duringRun(allowDriveDuringRun: boolean) {
    const robot = launchHarness();
    robot.session.allowDriveDuringRun = allowDriveDuringRun;
    await robot.session.launch.handle(oneBall);
    robot.notify(heartbeat({ running: true }));
    await flush();
    return robot;
  }

  it("holds the robot at stop when the setting is off", async () => {
    const { drive, motions } = await duringRun(false);

    await drive("go_front");

    expect(sentMotions(motions)).not.toContain("go_front");
  });

  it("passes the stick through when the setting is on", async () => {
    const { drive, motions } = await duringRun(true);

    await drive("go_front");

    expect(sentMotions(motions)).toContain("go_front");
  });

  it("still refuses a new launch while driving during a run", async () => {
    const { session, drive, types, reports } = await duringRun(true);
    await drive("go_left");

    await session.launch.handle(oneBall);

    expect(types().filter((type) => type === "set_mode")).toHaveLength(1);
    expect(reports.at(-1)).not.toBe("run_start sent");
  });

  it("logs only the first motion of each run", async () => {
    devLog.clear();
    const { session, drive, notify } = await duringRun(true);
    const logged = () => devLog.lines.filter((line) => line.includes("driving during run"));

    await drive("go_front");
    await drive("stop");
    await drive("go_back");
    const firstRun = logged().length;
    await drive("stop");
    notify(heartbeat({ running: false }));
    await drive("stop");
    await session.launch.handle(oneBall);
    notify(heartbeat({ running: true }));
    await flush();
    await drive("turn_left");

    expect(firstRun).toBe(1);
    expect(logged()).toHaveLength(2);
    expect(logged()[1]).toMatch(/driving during run: turn_left$/);
  });
});

describe("run info", () => {
  const runStartPush = (data: Record<string, unknown>) => JSON.stringify({ type: "run_start", ...data }) + END;

  it("records the set_mode mode and when run_start was sent", async () => {
    const { session, jump } = launchHarness();
    jump(5_000);

    await session.launch.handle(oneBall);

    expect(session.launch.run).toEqual({ mode: "ball_machine", startedAt: 5_000 });
  });

  it("prefers the robot's start_time from the run_start push", async () => {
    const { session, notify, jump } = launchHarness();
    jump(1_760_000_000_000);
    await session.launch.handle(oneBall);

    notify(runStartPush({ mode: "ball_machine", start_time: 1_759_999_999 }));
    await flush();

    expect(session.launch.run.startedAt).toBe(1_759_999_999_000);
  });
});

describe("emergency stop", () => {
  it("writes a stop motion, then run_stop, and clears the run", async () => {
    const { session, drive, types } = launchHarness();
    await drive("go_left");

    session.emergencyStop();
    await flush();

    expect(types().slice(-2)).toEqual(["motion_control", "run_stop"]);
    expect(session.motion).toBe("stop");
    expect(session.launch.running).toBe(false);
  });
});
