import { EventEmitter } from "node:events";
import { DriveLoop, type Motion } from "@acemate/core";
import { describe, expect, it } from "vitest";
import { attachControl, parseControl } from "../src/control-socket.js";

// A fake link and clock: sent records [ms, motion]; advance() ticks every 10 ms like the server does.
function harness() {
  let now = 0;
  const sent: [number, Motion][] = [];
  const loop = new DriveLoop(
    (motion) => sent.push([now, motion]),
    () => now,
  );
  const advance = (ms: number) => {
    for (const end = now + ms; now < end;) {
      now += 10;
      loop.tick();
    }
  };
  const at = (ms: number) => (now = ms);
  return { loop, sent, advance, at };
}

describe("control socket", () => {
  it("drives from page messages and stops when the socket closes", () => {
    const { loop, sent } = harness();
    const socket = new EventEmitter();
    attachControl(socket, loop);

    socket.emit("message", Buffer.from(JSON.stringify({ motion: "go_left" })));
    socket.emit("close");

    expect(sent).toEqual([
      [0, "go_left"],
      [0, "stop"],
    ]);
  });

  it("treats malformed or unknown messages as stop", () => {
    expect(parseControl("not json")).toBe("stop");
    expect(parseControl(JSON.stringify({ motion: "fly" }))).toBe("stop");
    expect(parseControl("null")).toBe("stop");
    expect(parseControl(JSON.stringify({ motion: "turn_left" }))).toBe("turn_left");
  });
});
