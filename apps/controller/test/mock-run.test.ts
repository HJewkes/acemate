import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockChannel } from "../src/robot/mock-channel";
import { DEFAULT_SESSION, RobotSession } from "../src/robot/session";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const oneBall = { kind: "machine", direction: 0, speed: 3, spin: 0, elevation: 20, count: 1, interval: 1 } as const;

// Ticks the session every 10 ms, as the app does, so heartbeats go out every 3 s.
async function run(session: RobotSession, ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 10) {
    session.tick();
    await vi.advanceTimersByTimeAsync(10);
  }
}

describe("a one-ball run against the mock robot", () => {
  it("ends on the run_stop push between heartbeats, with no did-not-start notice", async () => {
    const session = new RobotSession(new MockChannel(), () => undefined, Date.now);
    const reports: string[] = [];
    session.launch.listen({ report: (text) => reports.push(text), carState: () => undefined });
    // The first heartbeat shows the clock unset, so the session sends set_time before the run.
    await run(session, DEFAULT_SESSION.heartbeatMs + 100);

    const fired = session.launch.handle(oneBall);
    await vi.advanceTimersByTimeAsync(100);
    await fired;
    const activeAfterStart = session.launch.running;
    await run(session, 1100);

    expect(activeAfterStart).toBe(true);
    expect(session.launch.running).toBe(false);
    expect(reports.at(-1)).toBe("Run finished (run_stop ball_machine_finished)");
    await run(session, 10_000);
    expect(reports.join("\n")).not.toMatch(/did not start/);
  });
});
