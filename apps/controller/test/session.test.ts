import { describe, expect, it } from "vitest";
import type { ByteChannel } from "../src/robot/channel";
import { describeMessage } from "../src/robot/messages";
import { RobotSession } from "../src/robot/session";
import { dashedUuid } from "../src/robot/uuid";
import { flush, harness } from "./harness";

const motion = (m: string) => ({ type: "motion_control", data: { motion: m, shot_switch: "off" } });

describe("robot session", () => {
  it("asks for init data as soon as it opens", async () => {
    const { sent } = harness();
    await flush();

    expect(sent).toEqual([[0, { type: "ask_init_data" }]]);
  });

  it("sends each request as one whole write, without response while it fits one packet", async () => {
    const { drive, modes } = harness();
    await flush();

    await drive("go_front");

    expect(modes).toEqual([
      ["ask_init_data", false],
      ["motion_control", false],
    ]);
  });

  it("sends a held motion at once and every 50 ms", async () => {
    const { drive, motions, advance } = harness();

    await drive("go_front");
    for (let i = 0; i < 3; i++) {
      await advance(50);
      await drive("go_front");
    }

    expect(motions().map(([at]) => at)).toEqual([0, 50, 100, 150]);
    expect(motions()[0]?.[1]).toEqual(motion("go_front"));
  });

  it("sends stop immediately when the stick is released, then twice more", async () => {
    const { drive, motions, advance } = harness();
    await drive("turn_left");
    await advance(20);

    await drive("stop");
    await advance(200);

    expect(motions().map(([at, r]) => [at, (r as { data: { motion: string } }).data.motion])).toEqual([
      [0, "turn_left"],
      [20, "stop"],
      [70, "stop"],
      [120, "stop"],
    ]);
  });

  it("stops by itself when input goes quiet for 300 ms", async () => {
    const { drive, motions, advance } = harness();
    await drive("go_back");

    await advance(400);

    expect(motions().find(([, r]) => (r as { data: { motion: string } }).data.motion === "stop")?.[0]).toBe(300);
  });

  it("polls the heartbeat every 3 s while stopped and never while moving", async () => {
    const { drive, sent, advance } = harness();
    await advance(3000);
    for (let t = 0; t < 4000; t += 50) {
      await drive("go_front");
      await advance(50);
    }

    const beats = sent.filter(([, r]) => (r as { type: string }).type === "ask_heartbeat").map(([at]) => at);
    expect(beats).toEqual([3000]);
  });

  it("writes stop before closing the link on shutdown", async () => {
    const { session, drive, motions, events, advance } = harness();
    await drive("go_right");
    await advance(10);

    await session.shutdown();
    await advance(200);

    expect(motions().at(-1)?.[1]).toEqual(motion("stop"));
    expect(events).toEqual(["close"]);
    expect(motions().filter(([, r]) => (r as { data: { motion: string } }).data.motion === "go_right")).toHaveLength(1);
  });

  it("reassembles robot messages split across notifications on the +==ACE==+ marker", () => {
    const { notify, messages } = harness();

    notify('{"type":"rsp_heartbeat","data":{"car_state":{"mode":"ral');
    notify('ly","running":false,"bat":0}}}+==ACE==+{"type":"x"}+==ACE==+');

    expect(messages.map(describeMessage)).toEqual(["car_state mode rally running false bat 0", '{"type":"x"}']);
  });
});

describe("message log", () => {
  it("summarises init data", () => {
    const line = describeMessage({
      type: "rsp_init_data",
      data: { robot_id: "C421", rk_software_version: "v2.1.3_install", mode: "hdr" },
    });

    expect(line).toBe("init C421 fw v2.1.3_install mode hdr");
  });
});

describe("uuid", () => {
  it("dashes the undashed NUS service UUID for CoreBluetooth", () => {
    expect(dashedUuid("6e400001b5a3f393e0a9e50e24dcca9e")).toBe("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
  });
});

describe("write queue", () => {
  it("keeps sending motion after a write hangs, once the write timeout passes", async () => {
    const written: string[] = [];
    let calls = 0;
    const channel: ByteChannel = {
      name: "hangs-first",
      write: (data) => {
        calls += 1;
        if (calls === 1) return new Promise(() => undefined);
        written.push(JSON.parse(data.toString("utf8").slice(0, -2)).type);
        return Promise.resolve();
      },
      onData: () => () => undefined,
      onDisconnect: () => () => undefined,
      close: async () => undefined,
    };
    const session = new RobotSession(channel, () => undefined, () => 0);

    session.drive("go_front");
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(written).toContain("motion_control");
  });
});
