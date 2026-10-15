import { describe, expect, it } from "vitest";
import { applyStopLatch } from "../src/drive/input";

describe("emergency stop latch", () => {
  it("holds stop while input is still pushed", () => {
    expect(applyStopLatch(true, "go_front")).toEqual({ latched: true, motion: "stop" });
  });

  it("rearms once every input is neutral", () => {
    expect(applyStopLatch(true, "stop")).toEqual({ latched: false, motion: "stop" });
    expect(applyStopLatch(false, "go_front")).toEqual({ latched: false, motion: "go_front" });
  });
});
