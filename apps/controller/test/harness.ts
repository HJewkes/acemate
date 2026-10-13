import { expect } from "vitest";
import type { ByteChannel } from "../src/robot/channel";
import { RobotSession, type RobotMessage } from "../src/robot/session";
import type { Motion } from "../src/shared";

export type Sent = { type: string; data?: unknown };
/** Lets the fake robot answer a request, as a line it notifies on the next macrotask. */
export type Responder = (request: Sent) => string | undefined;

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// A fake BLE link that, like the robot, parses each write as one whole message; tagged with the fake clock.
export function harness(respond: Responder = () => undefined) {
  let now = 0;
  const sent: [number, Sent][] = [];
  const modes: [string, boolean][] = [];
  const events: string[] = [];
  const listeners: ((data: Buffer) => void)[] = [];
  const notify = (text: string) => listeners.forEach((listener) => listener(Buffer.from(text, "utf8")));
  const channel: ByteChannel = {
    name: "fake",
    async write(data, withResponse) {
      const text = data.toString("utf8");
      expect(text.endsWith("\r\n")).toBe(true);
      const request = JSON.parse(text.slice(0, -2)) as Sent;
      sent.push([now, request]);
      modes.push([request.type, withResponse]);
      const reply = respond(request);
      if (reply) setTimeout(() => notify(reply), 0);
    },
    onData(listener) {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    onDisconnect: () => () => undefined,
    async close() {
      events.push("close");
    },
  };
  const messages: RobotMessage[] = [];
  const session = new RobotSession(channel, (message) => messages.push(message), () => now);
  const advance = async (ms: number) => {
    for (const end = now + ms; now < end; ) {
      now += 10;
      session.tick();
      await flush();
    }
  };
  // Moves the clock without ticking, for waits far longer than the drive loop cares about.
  const jump = (ms: number) => {
    now += ms;
  };
  // Writes land a few microtasks after the call, so flush before the fake clock moves on.
  const drive = async (motion: Motion) => {
    session.drive(motion);
    await flush();
  };
  const motions = () => sent.filter(([, r]) => r.type === "motion_control");
  const types = () => sent.map(([, r]) => r.type);
  return { session, drive, sent, modes, events, messages, advance, jump, notify, motions, types };
}
