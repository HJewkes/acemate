import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { attachControl, parseControl } from "../src/control-socket.js";
import { DriveLoop } from "../src/drive-loop.js";
import type { Motion } from "../src/motion.js";

// A fake link and clock: sent records [ms, motion]; advance() ticks every 10 ms like the server does.
function harness() {
  let now = 0;
  const sent: [number, Motion][] = [];
  const loop = new DriveLoop((motion) => sent.push([now, motion]), () => now);
  const advance = (ms: number) => {
    for (const end = now + ms; now < end; ) {
      now += 10;
      loop.tick();
    }
  };
  const at = (ms: number) => (now = ms);
  return { loop, sent, advance, at };
}

describe("drive loop", () => {
  it("sends a new motion at once and resends it every 50 ms while input keeps arriving", () => {
    const { loop, sent, advance } = harness();

    loop.update("go_front");
    for (let i = 0; i < 4; i++) {
      advance(50);
      loop.update("go_front");
    }

    expect(sent).toEqual([[0, "go_front"], [50, "go_front"], [100, "go_front"], [150, "go_front"], [200, "go_front"]]);
  });

  it("sends stop immediately, without waiting for the resend slot", () => {
    const { loop, sent, advance, at } = harness();
    loop.update("turn_left");
    advance(20);

    at(23);
    loop.update("stop");

    expect(sent.at(-1)).toEqual([23, "stop"]);
  });

  it("repeats stop twice, then goes quiet", () => {
    const { loop, sent, advance } = harness();
    loop.update("go_back");
    loop.update("stop");

    advance(500);

    expect(sent).toEqual([[0, "go_back"], [0, "stop"], [50, "stop"], [100, "stop"]]);
  });

  it("stops when the page goes quiet for 300 ms", () => {
    const { loop, sent, advance } = harness();
    loop.update("go_right");

    advance(290);
    expect(sent.at(-1)?.[1]).toBe("go_right");
    advance(10);

    expect(sent.at(-1)).toEqual([300, "stop"]);
    expect(loop.motion).toBe("stop");
  });

  it("keeps driving through jittery heartbeats under the timeout", () => {
    const { loop, sent, advance } = harness();
    loop.update("go_front");
    for (let i = 0; i < 5; i++) {
      advance(250);
      loop.update("go_front");
    }

    expect(sent.some(([, motion]) => motion === "stop")).toBe(false);
  });

  it("switches straight from one motion to another", () => {
    const { loop, sent } = harness();
    loop.update("go_front");

    loop.update("turn_right");

    expect(sent).toEqual([[0, "go_front"], [0, "turn_right"]]);
  });
});

describe("control socket", () => {
  it("drives from page messages and stops when the socket closes", () => {
    const { loop, sent } = harness();
    const socket = new EventEmitter();
    attachControl(socket, loop);

    socket.emit("message", Buffer.from(JSON.stringify({ motion: "go_left" })));
    socket.emit("close");

    expect(sent).toEqual([[0, "go_left"], [0, "stop"]]);
  });

  it("treats malformed or unknown messages as stop", () => {
    expect(parseControl("not json")).toBe("stop");
    expect(parseControl(JSON.stringify({ motion: "fly" }))).toBe("stop");
    expect(parseControl("null")).toBe("stop");
    expect(parseControl(JSON.stringify({ motion: "turn_left" }))).toBe("turn_left");
  });
});
