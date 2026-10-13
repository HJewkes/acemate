import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "../../../tools/drive-probe/src/protocol.js";
import type { Link } from "../src/link.js";
import {
  HEARTBEAT_MS,
  RobotSession,
  SET_TIME_RETRY_MS,
  heartbeatDue,
  needsSetTime,
  type CarState,
  type SessionEvents,
} from "../src/session.js";

class FakeLink implements Link {
  readonly name = "fake";
  sent: Request[] = [];
  private listener: (line: string) => void = () => undefined;

  async send(request: Request): Promise<void> {
    this.sent.push(request);
  }
  onLine(listener: (line: string) => void): void {
    this.listener = listener;
  }
  onDisconnect(): void {}
  async close(): Promise<void> {
    this.sent.push({ type: "close" });
  }

  receive(message: Request): void {
    this.listener(`${JSON.stringify(message)}`);
  }
  types(): string[] {
    return this.sent.map((r) =>
      r.type === "motion_control" ? `motion:${(r.data as { motion: string }).motion}` : r.type,
    );
  }
}

const heartbeat = (carState: CarState): Request => ({ type: "rsp_heartbeat", data: { car_state: carState } });

function setup() {
  const link = new FakeLink();
  const events: SessionEvents = { onCarState: vi.fn(), onMessage: vi.fn(), onSent: vi.fn(), report: vi.fn() };
  const session = new RobotSession(link, events, { now: Date.now, timeZone: "America/Los_Angeles", countryCode: "US" });
  return { link, events, session };
}

beforeEach(() => vi.useFakeTimers({ now: 1_760_000_000_000 }));
afterEach(() => vi.useRealTimers());

describe("connecting", () => {
  it("sends nothing until start, then ask_init_data", async () => {
    const { link, session } = setup();
    expect(link.sent).toEqual([]);

    await session.start();

    expect(link.types()).toEqual(["ask_init_data"]);
  });
});

describe("set_time", () => {
  it("is sent when a heartbeat says the robot clock is unset, with epoch seconds and the time zone", () => {
    const { link } = setup();

    link.receive(heartbeat({ time_is_set: false, running: false }));

    expect(link.sent).toEqual([
      {
        type: "set_time",
        data: { unix_timestamp: 1_760_000_000, time_zone: "America/Los_Angeles", country_code: "US" },
      },
    ]);
  });

  it("is not repeated within the retry window, nor sent once the clock is set", () => {
    const { link } = setup();
    link.receive(heartbeat({ time_is_set: false }));

    vi.advanceTimersByTime(SET_TIME_RETRY_MS - 1);
    link.receive(heartbeat({ time_is_set: false }));
    link.receive(heartbeat({ time_is_set: true }));
    vi.advanceTimersByTime(2);
    link.receive(heartbeat({ time_is_set: false }));

    expect(link.types()).toEqual(["set_time", "set_time"]);
  });

  it("needsSetTime ignores heartbeats that omit time_is_set", () => {
    expect(needsSetTime({}, 1e9, -Infinity)).toBe(false);
  });
});

describe("heartbeat", () => {
  it("polls every 3 s while stopped", async () => {
    const { link, session } = setup();
    await session.start();

    for (let t = 0; t <= HEARTBEAT_MS * 2; t += 10) {
      vi.advanceTimersByTime(10);
      session.tick();
    }

    expect(link.types()).toEqual(["ask_init_data", "ask_heartbeat", "ask_heartbeat"]);
  });

  it("is skipped while driving and resumes after the stop", async () => {
    const { link, session } = setup();
    await session.start();

    for (let t = 0; t < HEARTBEAT_MS * 2; t += 10) {
      vi.advanceTimersByTime(10);
      session.drive("go_front");
      session.tick();
    }
    const whileDriving = link.types().filter((type) => type === "ask_heartbeat").length;
    session.release();
    session.tick();

    expect(whileDriving).toBe(0);
    expect(link.types().at(-1)).toBe("ask_heartbeat");
  });

  it("heartbeatDue is false while any motion is held", () => {
    expect(heartbeatDue("turn_left", 10_000, 0)).toBe(false);
    expect(heartbeatDue("stop", 10_000, 0)).toBe(true);
  });
});

describe("robot messages", () => {
  it("forwards heartbeat car_state to the page", () => {
    const { link, events } = setup();
    const carState = { bat: 76, running: false, mode: "rally", time_is_set: true };

    link.receive(heartbeat(carState));
    link.receive({ type: "rsp_init_data", data: {} });

    expect(events.onCarState).toHaveBeenCalledExactlyOnceWith(carState);
    expect(events.onMessage).toHaveBeenCalledTimes(2);
  });
});

async function startRun() {
  const fixture = setup();
  const fired = fixture.session.launch({
    kind: "machine",
    direction: 0,
    speed: 3,
    spin: 0,
    elevation: 20,
    count: 1,
    interval: 5,
  });
  await vi.advanceTimersByTimeAsync(0);
  fixture.link.receive({ type: "rsp_set_mode", data: { result: "ok" } });
  await fired;
  return fixture;
}

describe("launching", () => {
  it("starts a run only after rsp_set_mode, then holds drive input at stop", async () => {
    const { link, session } = await startRun();

    session.drive("go_front");

    expect(link.types()).toEqual(["set_mode", "run_start"]);
    expect(session.motion).toBe("stop");
  });

  it("clears the run when the heartbeat shows it finished", async () => {
    const { link, session } = await startRun();

    link.receive(heartbeat({ running: true }));
    link.receive(heartbeat({ running: false }));

    expect(session.launcher.running).toBe(false);
  });

  it("emergency stop sends run_stop and stops driving", async () => {
    const { link, session } = setup();
    session.drive("turn_right");

    await session.emergencyStop();

    expect(link.types()).toEqual(["motion:turn_right", "motion:stop", "run_stop"]);
  });

  it("sends one set_mode when a second fire arrives before rsp_set_mode", async () => {
    const { link, session, events } = setup();
    const shot = { kind: "machine", direction: 0, speed: 3, spin: 0, elevation: 20, count: 1, interval: 5 } as const;

    const first = session.launch(shot);
    await session.launch(shot);
    await vi.advanceTimersByTimeAsync(0);
    link.receive({ type: "rsp_set_mode", data: { result: "ok" } });
    await first;

    expect(link.types()).toEqual(["set_mode", "run_start"]);
    expect(events.report).toHaveBeenCalledWith("Still waiting for the last launch; try again.");
  });
});

describe("shutdown", () => {
  it("sends run_stop, then stop, then closes when a run is active", async () => {
    const { link, session } = await startRun();

    await session.shutdown();

    expect(link.types()).toEqual(["set_mode", "run_start", "run_stop", "motion:stop", "close"]);
  });

  it("sends run_stop while set_mode waits for its reply", async () => {
    const { link, session } = setup();
    const fired = session.launch({
      kind: "machine",
      direction: 0,
      speed: 3,
      spin: 0,
      elevation: 20,
      count: 1,
      interval: 5,
    });
    await vi.advanceTimersByTimeAsync(0);

    await session.shutdown();
    link.receive({ type: "rsp_set_mode", data: { result: "ok" } });
    await fired;

    expect(link.types()).toEqual(["set_mode", "run_stop", "motion:stop", "close"]);
  });

  it("sends no run_stop when no run is active", async () => {
    const { link, session } = setup();

    await session.shutdown();

    expect(link.types()).toEqual(["motion:stop", "close"]);
  });
});
