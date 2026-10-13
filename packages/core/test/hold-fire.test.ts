import { describe, expect, it } from "vitest";
import { createHoldFire } from "../src/controls/hold-fire";

const MS = 1000;

describe("hold-to-fire", () => {
  it("does not fire when released early", () => {
    const hold = createHoldFire(MS);
    hold.press(0);
    expect(hold.tick(999).fire).toBe(false);
    hold.release();

    expect(hold.tick(5000)).toEqual({ fire: false, progress: 0 });
  });

  it("reports progress while held and fires exactly once at full hold", () => {
    const hold = createHoldFire(MS);
    hold.press(100);

    expect(hold.tick(600).progress).toBeCloseTo(0.5);
    expect(hold.tick(1100).fire).toBe(true);
    expect(hold.tick(1200).fire).toBe(false);
    expect(hold.tick(9000).fire).toBe(false);
  });

  it("needs a release before a second fire", () => {
    const hold = createHoldFire(MS);
    hold.press(0);
    hold.tick(MS);
    hold.press(MS + 10);

    expect(hold.tick(5 * MS).fire).toBe(false);

    hold.release();
    hold.press(6 * MS);
    expect(hold.tick(7 * MS).fire).toBe(true);
  });

  it("resets the fill on cancel", () => {
    const hold = createHoldFire(MS);
    hold.press(0);
    hold.tick(800);

    expect(hold.cancel()).toEqual({ fire: false, progress: 0 });
    expect(hold.tick(2000).fire).toBe(false);
  });

  it("restarts the clock on a fresh press after cancel", () => {
    const hold = createHoldFire(MS);
    hold.press(0);
    hold.cancel();
    hold.press(900);

    expect(hold.tick(1500).fire).toBe(false);
    expect(hold.tick(1900).fire).toBe(true);
  });

  it("does not restart the hold when press is repeated while holding", () => {
    const hold = createHoldFire(MS);
    hold.press(0);
    hold.press(500);

    expect(hold.tick(1000).fire).toBe(true);
  });
});
