import { describe, expect, it } from "vitest";
import { MAX_CLOCK_SKEW_MS, NO_RUN, formatElapsed, modeLabel, runChip, runStartMs } from "../src/launcher/run-chip";

const SENT_AT = 1_760_000_000_000;

describe("run timer", () => {
  it("formats elapsed time as zero-padded mm:ss", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(9_999)).toBe("00:09");
    expect(formatElapsed(252_000)).toBe("04:12");
  });

  it("keeps counting minutes past an hour and never shows negative time", () => {
    expect(formatElapsed(3_725_000)).toBe("62:05");
    expect(formatElapsed(-4_000)).toBe("00:00");
  });

  it("uses the robot's start_time, read as seconds or milliseconds", () => {
    expect(runStartMs((SENT_AT - 2_000) / 1000, SENT_AT)).toBe(SENT_AT - 2_000);
    expect(runStartMs(SENT_AT - 1_500, SENT_AT)).toBe(SENT_AT - 1_500);
  });

  it("falls back to the send time when start_time is missing or the robot clock is off", () => {
    expect(runStartMs(undefined, SENT_AT)).toBe(SENT_AT);
    expect(runStartMs("soon", SENT_AT)).toBe(SENT_AT);
    expect(runStartMs(1234, SENT_AT)).toBe(SENT_AT);
    expect(runStartMs(SENT_AT + MAX_CLOCK_SKEW_MS + 1, SENT_AT)).toBe(SENT_AT);
  });
});

describe("run chip", () => {
  const ballMachine = { mode: "ball_machine", startedAt: SENT_AT };

  it("is hidden while idle", () => {
    expect(runChip({ runActive: false, inFlight: false, run: ballMachine, now: SENT_AT })).toBeNull();
  });

  it("shows the mode and elapsed time while a run is active", () => {
    expect(runChip({ runActive: true, inFlight: false, run: ballMachine, now: SENT_AT + 65_000 })).toEqual({
      mode: "Ball machine",
      elapsed: "01:05",
    });
  });

  it("shows while set_mode is in flight, before the run has a start time", () => {
    expect(runChip({ runActive: false, inFlight: true, run: NO_RUN, now: SENT_AT })).toEqual({ mode: "Starting", elapsed: "--:--" });
  });

  it("labels unknown modes readably", () => {
    expect(modeLabel("drill")).toBe("Drill");
    expect(modeLabel("serve_practice")).toBe("serve practice");
  });
});
