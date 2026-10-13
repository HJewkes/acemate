import { describe, expect, it } from "vitest";
import { DEBUG_LOG_LINES, LogBuffer, devLog } from "../src/debug/log-buffer";
import { flush, harness } from "./harness";

describe("debug log buffer", () => {
  it("keeps only the newest lines once full, oldest first", () => {
    const buffer = new LogBuffer(3);

    ["a", "b", "c", "d", "e"].forEach((line) => buffer.push(line));

    expect(buffer.lines).toEqual(["c", "d", "e"]);
  });

  it("holds about 200 lines by default", () => {
    const buffer = new LogBuffer();

    for (let i = 0; i < DEBUG_LOG_LINES + 50; i++) buffer.push(`line ${i}`);

    expect(DEBUG_LOG_LINES).toBe(200);
    expect(buffer.lines).toHaveLength(200);
    expect(buffer.lines[0]).toBe("line 50");
  });

  it("gives a new snapshot and tells subscribers on every change, including clear", () => {
    const buffer = new LogBuffer(5);
    let changes = 0;
    buffer.subscribe(() => changes++);
    buffer.push("a");
    const before = buffer.lines;

    buffer.clear();

    expect(changes).toBe(2);
    expect(buffer.lines).toEqual([]);
    expect(buffer.lines).not.toBe(before);
  });

  it("is fed by the session's rx/tx tracing and launch reports", async () => {
    devLog.clear();
    const { session, notify } = harness();

    notify('{"type":"x"}+==ACE==+');
    await session.launch.handle({ kind: "stop" });
    await flush();

    const lines = devLog.lines.join("\n");
    expect(lines).toContain('tx {"type":"ask_init_data"}');
    expect(lines).toContain('rx {"type":"x"}');
    expect(lines).toMatch(/launch /);
  });
});
