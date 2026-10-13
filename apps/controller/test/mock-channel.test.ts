import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Buffer } from "buffer";
import { LineDecoder, encodeLine, requests } from "@acemate/core";
import { MockChannel, mockRequested } from "../src/robot/mock-channel";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("mockRequested", () => {
  it("turns mock mode on for ?mock=1 and leaves it off otherwise", () => {
    expect(mockRequested("?mock=1")).toBe(true);
    expect(mockRequested("?theme=dark&mock")).toBe(true);
    expect(mockRequested("")).toBe(false);
  });
});

describe("MockChannel", () => {
  it("delivers the mock robot's replies as marker-terminated notifications", async () => {
    const channel = new MockChannel();
    const decoder = new LineDecoder();
    const lines: string[] = [];
    channel.onData((data) => lines.push(...decoder.push(data)));

    await channel.write(encodeLine(requests.heartbeat()));
    vi.advanceTimersByTime(30);

    expect(lines.map((line) => (JSON.parse(line) as { type: string }).type)).toEqual(["rsp_heartbeat"]);
  });

  it("reports a disconnect once on close and refuses later writes", async () => {
    const channel = new MockChannel();
    const onDisconnect = vi.fn();
    channel.onDisconnect(onDisconnect);

    await channel.close();
    await channel.close();

    expect(onDisconnect).toHaveBeenCalledTimes(1);
    await expect(channel.write(Buffer.from("{}"))).rejects.toThrow("Robot is disconnected");
  });
});
