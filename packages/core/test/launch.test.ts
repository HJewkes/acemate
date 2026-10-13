import { describe, expect, it } from "vitest";
import { LaunchValidationError, ballMachine, runRequests, singleShot, targetShot } from "../src/protocol/launch";
import { encodeLine } from "../src/protocol/protocol";

const centre = { direction: 0, speed: 3, spin: 0, elevation: 20 };

describe("single ball_machine shot", () => {
  it("encodes the app's ball_machine schema with one ball and total_balls 1", () => {
    const line = encodeLine(singleShot(centre)).toString("utf8");

    expect(line).toBe(
      '{"type":"set_mode","data":{"mode":"ball_machine","interval":1,"b":[[0,3,0,20]],"total_balls":1,' +
        '"random_order":false,"group_interval":0,"train_id":"drive_probe"}}\r\n',
    );
  });

  it("negates direction in the payload, as the app does", () => {
    const request = singleShot({ ...centre, direction: 5 });

    expect((request.data as { b: number[][] }).b).toEqual([[-5, 3, 0, 20]]);
  });
});

describe("ball_machine validation", () => {
  it.each([
    ["speed", { ...centre, speed: 0 }],
    ["speed", { ...centre, speed: 11 }],
    ["spin", { ...centre, spin: -4 }],
    ["spin", { ...centre, spin: 4 }],
    ["elevation", { ...centre, elevation: 9 }],
    ["elevation", { ...centre, elevation: 41 }],
    ["direction", { ...centre, direction: -16 }],
    ["direction", { ...centre, direction: 16 }],
    ["speed", { ...centre, speed: 2.5 }],
    ["speed", { ...centre, speed: Number.NaN }],
  ])("rejects an out-of-range or non-integer %s", (field, ball) => {
    expect(() => singleShot(ball)).toThrow(new RegExp(field));
  });

  it("accepts the S10 range endpoints", () => {
    const edges = [
      { direction: -15, speed: 1, spin: -3, elevation: 10 },
      { direction: 15, speed: 10, spin: 3, elevation: 40 },
    ];

    expect(() => ballMachine({ balls: edges, interval: 15 })).not.toThrow();
  });

  it("rejects intervals outside 1..15 s or off the 0.5 s step", () => {
    for (const interval of [0.5, 15.5, 2.25]) {
      expect(() => ballMachine({ balls: [centre], interval })).toThrow(LaunchValidationError);
    }
  });

  it("rejects an empty sequence and a total above the probe cap", () => {
    expect(() => ballMachine({ balls: [] })).toThrow(LaunchValidationError);
    expect(() => ballMachine({ balls: [centre], totalBalls: 11 })).toThrow(/total_balls/);
  });
});

describe("target shot", () => {
  it("sends the drill schema with the height level converted to metres and no net catch", () => {
    const request = targetShot({ x: 1, z: 16, heightLevel: 3, spin: 0 });

    expect(request.data).toMatchObject({
      mode: "drill",
      total_balls: 1,
      need_catch_ball: false,
      balls: [{ shot: { target: [{ location: null, x: 1, z: 16 }], spin: 0, height: 1.8 }, receiving_area: null }],
    });
  });

  it("rejects targets outside the singles court and unsupported depths", () => {
    expect(() => targetShot({ x: 4.2, z: 16, heightLevel: 3, spin: 0 })).toThrow(/x/);
    expect(() => targetShot({ x: 0, z: 24, heightLevel: 3, spin: 0 })).toThrow(/z/);
    expect(() => targetShot({ x: 0, z: 16, heightLevel: 11, spin: 0 })).toThrow(/height level/);
  });
});

describe("run control", () => {
  it("matches the app's bare run_start, run_pause and run_stop messages", () => {
    expect([runRequests.start(), runRequests.pause(), runRequests.stop()]).toEqual([
      { type: "run_start" },
      { type: "run_pause" },
      { type: "run_stop" },
    ]);
  });
});
