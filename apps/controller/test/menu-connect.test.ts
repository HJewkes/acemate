import { describe, expect, it } from "vitest";
import { connectsOnMenuOpen } from "../src/robot/menu-connect";

describe("opening the device menu", () => {
  it("opens the browser's chooser on web when no robot is linked", () => {
    expect(connectsOnMenuOpen("disconnected", false)).toBe(true);
  });

  it("leaves a linked or connecting robot alone", () => {
    for (const status of ["connected", "connecting", "scanning"] as const) {
      expect(connectsOnMenuOpen(status, false)).toBe(false);
    }
  });

  it("never connects on native, which reconnects by itself and lists nearby robots in the menu", () => {
    expect(connectsOnMenuOpen("disconnected", true)).toBe(false);
  });
});
