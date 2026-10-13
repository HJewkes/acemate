import { describe, expect, it, vi } from "vitest";
import { parseLaunchArgs, runLaunch, type LaunchDeps } from "../src/launch-session.js";
import type { Link } from "../src/link.js";
import type { Request } from "../src/protocol.js";

const SINGLE = ["single", "--dir", "0", "--speed", "3", "--spin", "0", "--elev", "20"];
const IDLE = { type: "rsp_heartbeat", data: { car_state: { running: false } } };

type Replies = Partial<Record<string, unknown>>;

// A fake robot that answers each request type with a canned reply (or stays silent).
function fakeLink(replies: Replies): { link: Link; sent: string[] } {
  const sent: string[] = [];
  let listener: (line: string) => void = () => undefined;
  const link = {
    peripheral: {} as Link["peripheral"],
    send: async (request: Request) => {
      sent.push(request.type);
      const reply = replies[request.type];
      if (reply) setTimeout(() => listener(JSON.stringify(reply)), 0);
    },
    onLine: (fn: (line: string) => void) => (listener = fn),
    close: vi.fn(async () => undefined),
  };
  return { link, sent };
}

function deps(link?: Link): LaunchDeps & { open: ReturnType<typeof vi.fn>; lines: string[] } {
  const lines: string[] = [];
  return {
    open: vi.fn(async () => link as Link),
    print: (line: string) => lines.push(line),
    record: () => undefined,
    sleep: async () => undefined,
    onInterrupt: () => undefined,
    lines,
  };
}

async function fire(replies: Replies) {
  const { link, sent } = fakeLink(replies);
  const { setMode, options } = parseLaunchArgs([...SINGLE, "--fire", "--timeout", "30", "--watch", "1"]);
  const code = await runLaunch(setMode, options, deps(link));
  return { code, sent, link };
}

describe("dry run", () => {
  it("prints the exact set_mode JSON and never opens the link", async () => {
    const { setMode, options } = parseLaunchArgs(SINGLE);
    const d = deps();

    const code = await runLaunch(setMode, options, d);

    expect(code).toBe(0);
    expect(d.open).not.toHaveBeenCalled();
    expect(d.lines).toContain(
      '{"type":"set_mode","data":{"mode":"ball_machine","interval":1,"b":[[0,3,0,20]],"total_balls":1,' +
        '"random_order":false,"group_interval":0,"train_id":"drive_probe"}}',
    );
  });

  it("rejects a missing parameter instead of defaulting it", () => {
    expect(() => parseLaunchArgs(["single", "--dir", "0", "--spin", "0", "--elev", "20"])).toThrow(/--speed is required/);
  });
});

describe("fire", () => {
  const happy = {
    ask_init_data: { type: "rsp_init_data", data: {} },
    ask_heartbeat: IDLE,
    set_mode: { type: "rsp_set_mode", data: { mode: "ball_machine" } },
  };

  it("sends init, heartbeat, set_mode, run_start in order and run_stop before closing", async () => {
    const { code, sent, link } = await fire(happy);

    expect(code).toBe(0);
    expect(sent.slice(0, 4)).toEqual(["ask_init_data", "ask_heartbeat", "set_mode", "run_start"]);
    expect(sent.at(-1)).toBe("run_stop");
    expect(link.close).toHaveBeenCalled();
  });

  it("never sends run_start when rsp_set_mode does not arrive, and still sends run_stop", async () => {
    const { code, sent } = await fire({ ...happy, set_mode: undefined });

    expect(code).toBe(1);
    expect(sent).not.toContain("run_start");
    expect(sent.at(-1)).toBe("run_stop");
  });

  it("refuses to configure a robot whose heartbeat says it is already running", async () => {
    const { code, sent } = await fire({ ...happy, ask_heartbeat: { type: "rsp_heartbeat", data: { car_state: { running: true } } } });

    expect(code).toBe(1);
    expect(sent).not.toContain("set_mode");
    expect(sent.at(-1)).toBe("run_stop");
  });
});
