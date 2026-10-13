import { describe, expect, it } from "vitest";
import { fireLock } from "../src/launcher-ui/shell.js";

const ready = { connected: true, running: false, inFlight: false };

describe("web Fire lock", () => {
  it("lets Fire be held when connected and idle", () => {
    expect(fireLock(ready)).toBe("");
  });

  it("locks Fire while a set_mode waits for its reply", () => {
    expect(fireLock({ ...ready, inFlight: true })).toBe("Waiting for the robot");
  });

  it("locks Fire while disconnected or while a run is active", () => {
    expect(fireLock({ ...ready, connected: false })).toBe("Connect first");
    expect(fireLock({ ...ready, running: true })).toBe("A run is active");
  });
});
