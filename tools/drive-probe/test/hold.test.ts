import { describe, expect, it } from "vitest";
import { DEFAULT_HOLD, initialHold, press, tick, type HoldState } from "../src/hold.js";
import { keyAction } from "../src/keys.js";
import type { Motion } from "@acemate/core";

const config = DEFAULT_HOLD;

// Mimics macOS defaults: first press, 225 ms initial delay, then repeats every 30 ms up to lastRepeatAt.
function holdKey(motion: Motion, from: number, lastRepeatAt: number): HoldState {
  let state = tick(press(initialHold(), motion, from, config), from, config).state;
  for (let t = from + 225; t <= lastRepeatAt; t += 30) state = press(state, motion, t, config);
  return state;
}

describe("hold-to-drive", () => {
  it("sends a new direction on the first tick after the press", () => {
    const pressed = press(initialHold(), "go_front", 1000, config);

    expect(tick(pressed, 1000, config).send).toBe("go_front");
  });

  it("resends a held direction only every resendMs", () => {
    const sent = tick(press(initialHold(), "go_front", 1000, config), 1000, config).state;

    expect(tick(sent, 1150, config).send).toBeNull();
    expect(tick(sent, 1200, config).send).toBe("go_front");
  });

  it("stops about repeatHoldMs after key-repeat goes quiet", () => {
    const held = holdKey("turn_left", 1000, 1615);

    expect(tick(held, 1615 + 80, config).send).not.toBe("stop");
    expect(tick(held, 1615 + 100, config).send).toBe("stop");
  });

  it("waits out the OS initial repeat delay before treating a single press as released", () => {
    const tapped = tick(press(initialHold(), "go_back", 1000, config), 1000, config).state;

    expect(tick(tapped, 1250, config).send).not.toBe("stop");
    expect(tick(tapped, 1310, config).send).toBe("stop");
  });

  it("sends exactly one stop after release", () => {
    const stopped = tick(holdKey("go_left", 1000, 1495), 1700, config);

    expect(stopped.send).toBe("stop");
    expect(tick(stopped.state, 1900, config).send).toBeNull();
  });

  it("stops on the next tick when space is pressed mid-drive", () => {
    const held = holdKey("go_back", 1000, 1495);

    expect(tick(press(held, "stop", 1510, config), 1510, config).send).toBe("stop");
  });

  it("switches direction immediately while another key is held", () => {
    const held = holdKey("go_front", 1000, 1495);

    expect(tick(press(held, "turn_right", 1510, config), 1510, config).send).toBe("turn_right");
  });
});

describe("keyAction", () => {
  it("maps WASD case-insensitively and treats Ctrl-C as quit", () => {
    expect(keyAction("W")).toEqual({ kind: "motion", motion: "go_front" });
    expect(keyAction("d")).toEqual({ kind: "motion", motion: "go_right" });
    expect(keyAction("\u0003")).toEqual({ kind: "quit" });
    expect(keyAction("z")).toEqual({ kind: "ignore" });
  });
});
