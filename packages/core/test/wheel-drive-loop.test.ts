import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveWheelCommand, WheelDriveLoop } from "../src/drive/wheel-drive-loop";
import { MockRobot } from "../src/mock/mock-robot";
import { factoryTestRequests } from "../src/protocol/wheel-test";
import { lineText, type Request } from "../src/protocol/protocol";

const stick = (x: number, y: number) => ({ x, y, turn: 0 });

describe("resolveWheelCommand", () => {
  it("drives forward at full speed for a full forward push", () => {
    expect(resolveWheelCommand(stick(0, 1))).toEqual({ direction: "drive_up", speed: 10 });
  });

  it("maps each axis to its direction, with left and right as strafes", () => {
    expect(resolveWheelCommand(stick(0, -1))?.direction).toBe("drive_down");
    expect(resolveWheelCommand(stick(-1, 0))?.direction).toBe("drive_left");
    expect(resolveWheelCommand(stick(1, 0))?.direction).toBe("drive_right");
  });

  it("picks the dominant axis of a diagonal push", () => {
    expect(resolveWheelCommand(stick(0.6, 0.8))?.direction).toBe("drive_up");
    expect(resolveWheelCommand(stick(0.8, -0.6))?.direction).toBe("drive_right");
    expect(resolveWheelCommand(stick(-0.8, -0.6))?.direction).toBe("drive_left");
  });

  it("lets forward/back win an exact 45-degree tie", () => {
    expect(resolveWheelCommand(stick(-0.5, -0.5))?.direction).toBe("drive_down");
  });

  it("scales speed with how far the stick is pushed", () => {
    expect(resolveWheelCommand(stick(0, 0.5))?.speed).toBe(5);
    expect(resolveWheelCommand(stick(0.3, 0))?.speed).toBe(3);
  });

  it("clamps speed to 1 just past the deadzone and to 10 for an overdriven corner", () => {
    const rule = { deadzone: 0.01, maxSpeed: 10 };

    expect(resolveWheelCommand(stick(0, 0.02), rule)?.speed).toBe(1);
    expect(resolveWheelCommand(stick(1, 1))?.speed).toBe(10);
  });

  it("caps speed at the rule's maxSpeed", () => {
    expect(resolveWheelCommand(stick(0, 1), { deadzone: 0.25, maxSpeed: 4 })?.speed).toBe(4);
  });

  it("returns no command inside the deadzone and ignores turn", () => {
    expect(resolveWheelCommand(stick(0.1, 0.2))).toBeNull();
    expect(resolveWheelCommand({ x: 0, y: 0, turn: 1 })).toBeNull();
  });
});

// A fake link and clock: sent records [ms, request]; advance() ticks every 10 ms like a controller does.
function harness() {
  let now = 0;
  const sent: [number, Request][] = [];
  const loop = new WheelDriveLoop(
    (request) => sent.push([now, request]),
    () => now,
  );
  const advance = (ms: number) => {
    for (const end = now + ms; now < end;) {
      now += 10;
      loop.tick();
    }
  };
  return { loop, sent, advance };
}

const up = (speed: number) => factoryTestRequests.wheelStart("drive_up", speed);
const stop = factoryTestRequests.wheelStop();

describe("wheel drive loop lifecycle", () => {
  it("enters factory mode once on start", () => {
    const { loop, sent } = harness();

    loop.start();
    loop.start();

    expect(sent).toEqual([[0, factoryTestRequests.enter()]]);
  });

  it("sends nothing for input before start", () => {
    const { loop, sent, advance } = harness();

    loop.update(stick(0, 1));
    advance(300);

    expect(sent).toEqual([]);
  });

  it("stops the wheels and then exits factory mode on close", () => {
    const { loop, sent, advance } = harness();
    loop.start();
    loop.update(stick(0, 1));

    loop.close();
    advance(500);

    expect(sent.map(([, request]) => request)).toEqual([
      factoryTestRequests.enter(),
      up(10),
      stop,
      factoryTestRequests.exit(),
    ]);
    expect(loop.active).toBe(false);
  });
});

describe("wheel drive loop cadence", () => {
  it("resends the held command every 100 ms while input keeps arriving", () => {
    const { loop, sent, advance } = harness();
    loop.start();

    loop.update(stick(0, 1));
    for (let i = 0; i < 3; i++) {
      advance(100);
      loop.update(stick(0, 1));
    }

    expect(sent.slice(1)).toEqual([
      [0, up(10)],
      [100, up(10)],
      [200, up(10)],
      [300, up(10)],
    ]);
  });

  it("sends a changed speed at once, without waiting for the resend slot", () => {
    const { loop, sent, advance } = harness();
    loop.start();
    loop.update(stick(0, 1));
    advance(30);

    loop.update(stick(0, 0.5));

    expect(sent.at(-1)).toEqual([30, up(5)]);
  });

  it("sends stop on release, repeats it twice, then goes quiet", () => {
    const { loop, sent, advance } = harness();
    loop.start();
    loop.update(stick(0, 1));

    loop.release();
    advance(1000);

    expect(sent.slice(2)).toEqual([
      [0, stop],
      [100, stop],
      [200, stop],
    ]);
  });
});

describe("wheel drive loop dead-man", () => {
  it("stops the wheels when input goes quiet for 500 ms", () => {
    const { loop, sent, advance } = harness();
    loop.start();
    loop.update(stick(1, 0));

    advance(490);
    const beforeTimeout = sent.at(-1)?.[1];
    advance(10);

    expect(beforeTimeout).toEqual(factoryTestRequests.wheelStart("drive_right", 10));
    expect(sent.at(-1)).toEqual([500, stop]);
    expect(loop.command).toBeNull();
  });

  it("keeps driving through jittery input under the timeout", () => {
    const { loop, sent, advance } = harness();
    loop.start();
    loop.update(stick(0, 1));
    for (let i = 0; i < 5; i++) {
      advance(450);
      loop.update(stick(0, 1));
    }

    expect(sent.some(([, request]) => request.action === "stop")).toBe(false);
  });
});

describe("wheel drive loop against the mock robot", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function mockHarness() {
    const replies: Request[] = [];
    const robot = new MockRobot((message) => replies.push(message));
    const loop = new WheelDriveLoop(
      (request) => robot.receive(lineText(request)),
      () => Date.now(),
    );
    const timer = setInterval(() => loop.tick(), 10);
    return { robot, loop, replies, done: () => clearInterval(timer) };
  }

  it("keeps the wheels turning while held and stops them after the dead-man timeout", () => {
    const { robot, loop, done } = mockHarness();
    loop.start();
    loop.update(stick(0, -0.7));

    vi.advanceTimersByTime(450);
    const held = robot.factoryState.wheels;
    vi.advanceTimersByTime(100);

    expect(held).toEqual({ direction: "drive_down", speed: 7 });
    expect(robot.factoryState.wheels).toBeNull();
    expect(robot.factoryState.factoryMode).toBe(true);
    done();
  });

  it("leaves factory mode on close and acks each step", () => {
    const { robot, loop, replies, done } = mockHarness();
    loop.start();
    loop.update(stick(0, 1));

    loop.close();
    vi.advanceTimersByTime(50);

    expect(robot.factoryState).toEqual({ factoryMode: false, wheels: null });
    expect(replies.map((reply) => `${reply.command ?? ""}/${String(reply.action)}/${String(reply.result)}`)).toEqual([
      "/start/success",
      "wheel_test/start/success",
      "wheel_test/stop/success",
      "/stop/success",
    ]);
    done();
  });
});
