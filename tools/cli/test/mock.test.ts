import { describe, expect, it } from "vitest";
import { parseCli } from "../src/args.js";
import { parseLaunchArgs, runLaunch } from "../src/launch.js";
import { createMockLink } from "../src/mock-link.js";
import { runSend } from "../src/send.js";

const noSleep = async () => undefined;

function sendDeps(chunkSize = 512) {
  const lines: string[] = [];
  const recorded: Array<{ direction: string; payload: unknown }> = [];
  return {
    lines,
    recorded,
    deps: {
      open: async () => createMockLink(chunkSize),
      print: (line: string) => lines.push(line),
      record: (direction: string, payload: unknown) => recorded.push({ direction, payload }),
      sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.min(ms, 100))),
    },
  };
}

describe("--mock", () => {
  it("is read by every command and by launch", () => {
    const parsed = parseCli(["send", "{}", "--mock"]);

    expect(parsed.kind === "run" && parsed.options.mock).toBe(true);
    expect(
      parseLaunchArgs(["single", "--dir", "0", "--speed", "3", "--spin", "0", "--elev", "20", "--mock"]).options.mock,
    ).toBe(true);
  });
});

describe("send against the mock robot", () => {
  it("prints the robot's reply, split at the +==ACE==+ ending, and logs it", async () => {
    const { lines, recorded, deps } = sendDeps();

    const code = await runSend('{"type":"set_time"}', 0.2, deps);

    expect(code).toBe(0);
    expect(lines.some((line) => line.startsWith('← {"type":"rsp_set_time"'))).toBe(true);
    expect(lines.some((line) => line.startsWith('← {"type":"rsp_init_data"'))).toBe(true);
    expect(recorded.filter((entry) => entry.direction === "rx")).toHaveLength(2);
  });

  it("gets no run_start reply before set_time, and one after", async () => {
    const before = sendDeps();
    await runSend('{"type":"run_start"}', 0.2, before.deps);
    const link = createMockLink(512);
    const heard: string[] = [];
    link.onLine((line) => heard.push(line));
    await link.send({ type: "set_time" });
    await link.send({ type: "run_start" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await link.close();

    expect(before.lines.filter((line) => line.startsWith("←") && line.includes('"type":"run_start"'))).toEqual([]);
    expect(heard.some((line) => line.includes('"type":"run_start"'))).toBe(true);
  });

  it("ignores a request split across writes by a small --chunk", async () => {
    const { lines, deps } = sendDeps(8);

    await runSend('{"type":"ask_heartbeat"}', 0.2, deps);

    expect(lines.filter((line) => line.startsWith("←"))).toEqual([]);
  });

  it("still refuses OTA and never opens the mock", async () => {
    const { lines, deps } = sendDeps();
    let opened = false;

    const code = await runSend('{"type":"mcu_ota","data":{}}', null, {
      ...deps,
      open: async () => ((opened = true), createMockLink(512)),
    });

    expect(code).toBe(2);
    expect(opened).toBe(false);
    expect(lines[0]).toMatch(/^Refused "mcu_ota"/);
  });
});

describe("launch --fire against the mock robot", () => {
  it("sends run_start but sees no run, because the CLI never sets the robot's clock", async () => {
    const { lines, recorded, deps } = sendDeps();
    const argv = [
      "single",
      "--dir",
      "0",
      "--speed",
      "3",
      "--spin",
      "0",
      "--elev",
      "20",
      "--fire",
      "--mock",
      "--watch",
      "2",
    ];
    const { setMode, options } = parseLaunchArgs(argv);

    const code = await runLaunch(setMode, options, {
      ...deps,
      sleep: noSleep,
      onInterrupt: () => undefined,
      open: async () => createMockLink(options.chunk),
    });

    expect(code).toBe(0);
    expect(lines.some((line) => line.startsWith('← {"type":"rsp_set_mode"'))).toBe(true);
    expect(lines.join("\n")).toContain("without seeing running:true");
    expect(recorded.filter((e) => e.direction === "tx").map((e) => (e.payload as { type: string }).type)).toEqual([
      "ask_init_data",
      "ask_heartbeat",
      "set_mode",
      "run_start",
      "ask_heartbeat",
      "ask_heartbeat",
      "run_stop",
    ]);
  });
});
