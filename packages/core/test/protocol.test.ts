import { describe, expect, it } from "vitest";
import { LineDecoder, chunk, encodeLine, parseMessage, requests } from "../src/protocol/protocol";

describe("motion command encoding", () => {
  it("matches the app's motion_control JSON with a CRLF terminator", () => {
    const line = encodeLine(requests.motion("go_front")).toString("utf8");

    expect(line).toBe('{"type":"motion_control","data":{"motion":"go_front","shot_switch":"off"}}\r\n');
  });

  it("adds an integer speed to a diagonal motion and keeps the launcher off", () => {
    const line = encodeLine(requests.motionWithSpeed("go_back_left", 4)).toString("utf8");

    expect(line).toBe('{"type":"motion_control","data":{"motion":"go_back_left","speed":4,"shot_switch":"off"}}\r\n');
  });
});

describe("chunk", () => {
  it("splits a long write into MTU-sized parts that rejoin losslessly", () => {
    const buffer = Buffer.from("x".repeat(450));

    const parts = chunk(buffer, 180);

    expect(parts.map((p) => p.length)).toEqual([180, 180, 90]);
    expect(Buffer.concat(parts).equals(buffer)).toBe(true);
  });
});

describe("LineDecoder", () => {
  it("reassembles a message split across notifications", () => {
    const decoder = new LineDecoder();

    const first = decoder.push(Buffer.from('{"type":"rsp_hea'));
    const second = decoder.push(Buffer.from('rtbeat"}\r\n{"type":"alert"}\r\n'));

    expect(first).toEqual([]);
    expect(second).toEqual(['{"type":"rsp_heartbeat"}', '{"type":"alert"}']);
  });

  it("splits robot messages on the +==ACE==+ end marker, even when it straddles notifications", () => {
    const decoder = new LineDecoder();

    const first = decoder.push(Buffer.from('{"type":"rsp_init_data"}+==AC'));
    const second = decoder.push(Buffer.from('E==+{"type":"rsp_heartbeat"}+==ACE==+'));

    expect(first).toEqual([]);
    expect(second).toEqual(['{"type":"rsp_init_data"}', '{"type":"rsp_heartbeat"}']);
  });
});

describe("LineDecoder with browser bytes", () => {
  it("keeps a multi-byte character whole when a notification splits it", () => {
    const decoder = new LineDecoder();
    const bytes = new TextEncoder().encode('{"n":"é"}+==ACE==+');
    const split = bytes.indexOf(0xa9);

    const first = decoder.push(bytes.subarray(0, split));
    const second = decoder.push(bytes.subarray(split));

    expect(first).toEqual([]);
    expect(second).toEqual(['{"n":"é"}']);
  });
});

describe("parseMessage", () => {
  it("keeps non-JSON lines as raw so nothing from the robot is dropped", () => {
    expect(parseMessage("hello")).toEqual({ type: "raw", line: "hello" });
  });
});
