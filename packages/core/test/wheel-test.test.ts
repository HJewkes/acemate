import { describe, expect, it } from "vitest";
import { factoryTestRequests } from "../src/protocol/wheel-test";
import { lineText } from "../src/protocol/protocol";

describe("factory test requests", () => {
  it("frames wheel_test start exactly as the hardware accepted it", () => {
    const text = lineText(factoryTestRequests.wheelStart("drive_left", 4));

    expect(text).toBe(
      '{"type":"factory_test","command":"wheel_test","action":"start","data":{"direction":"drive_left","speed":4}}\r\n',
    );
  });

  it("rejects a speed outside 1..10 or a fraction", () => {
    expect(() => factoryTestRequests.wheelStart("drive_up", 0)).toThrow(RangeError);
    expect(() => factoryTestRequests.wheelStart("drive_up", 11)).toThrow(RangeError);
    expect(() => factoryTestRequests.wheelStart("drive_up", 2.5)).toThrow(RangeError);
  });
});
