import { describe, expect, it, vi } from "vitest";
import type { Link } from "../src/link.js";
import { refusal, runSend, type SendDeps } from "../src/send.js";
import type { Request } from "@acemate/core";

function fakeLink(reply: string): { link: Link; sent: Request[] } {
  const sent: Request[] = [];
  let listener: (line: string) => void = () => undefined;
  const link = {
    peripheral: {} as Link["peripheral"],
    send: async (request: Request) => {
      sent.push(request);
      listener(reply);
    },
    onLine: (fn: (line: string) => void) => (listener = fn),
    close: vi.fn(async () => undefined),
  };
  return { link, sent };
}

function deps(link: Link): SendDeps & { open: ReturnType<typeof vi.fn>; lines: string[]; sleeps: number[] } {
  const lines: string[] = [];
  const sleeps: number[] = [];
  return {
    open: vi.fn(async () => link),
    print: (line: string) => lines.push(line),
    record: () => undefined,
    sleep: async (ms: number) => void sleeps.push(ms),
    lines,
    sleeps,
  };
}

const REFUSED = [
  '{"type":"mcu_ota","data":{}}',
  '{"type":"start_ota_upgrade"}',
  '{"type":"ap","data":{"purpose":"ota","wifi_band":"5G","channels":[36]}}',
  '{"type":"http","path":"/upload"}',
  '{"type":"http","path":"/trigger_update"}',
  '{"type":"cross_app_feature","command":"camera_calib","action":"start_calib_extrinsic","data":{}}',
  '{"type":"req_set_court_profile","data":{"court_id":"x","court_profile":{}}}',
];

describe("send denylist", () => {
  it.each(REFUSED)("refuses %s without connecting and says why", async (json) => {
    const { link } = fakeLink("");
    const d = deps(link);

    const code = await runSend(json, null, d);

    expect(code).toBe(2);
    expect(d.open).not.toHaveBeenCalled();
    expect(d.lines.join("\n")).toMatch(/^Refused ".+", not sent: .+\.$/);
  });

  it("lets keys that merely contain the letters 'ota' through", () => {
    const setMode = { type: "set_mode", data: { mode: "ball_machine", total_balls: 1 } };

    expect(refusal(setMode)).toBeNull();
  });

  it("rejects text that is not a JSON object with a string type", async () => {
    const d = deps(fakeLink("").link);

    expect(await runSend("[1]", null, d)).toBe(2);
    expect(await runSend('{"type":3}', null, d)).toBe(2);
    expect(await runSend("{oops", null, d)).toBe(2);
    expect(d.open).not.toHaveBeenCalled();
  });
});

describe("send passthrough", () => {
  it("sends ask_init_data then the exact request, prints replies and closes after the watch window", async () => {
    const reply = '{"type":"rsp_court_profile","data":{}}';
    const { link, sent } = fakeLink(reply);
    const d = deps(link);

    const code = await runSend('{"type":"ask_court_profile"}', 3, d);

    expect(code).toBe(0);
    expect(sent).toEqual([{ type: "ask_init_data" }, { type: "ask_court_profile" }]);
    expect(d.lines).toContain(`← ${reply}`);
    expect(d.sleeps.at(-1)).toBe(3000);
    expect(link.close).toHaveBeenCalledOnce();
  });
});
