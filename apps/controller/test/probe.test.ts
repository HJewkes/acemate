import { describe, expect, it } from "vitest";
import { probeLines } from "../src/debug/probe";

const base = { userAgent: "Bluefy/3.9", secureContext: true, writeWithoutResponse: true };

describe("web bluetooth probe", () => {
  it("reports each API a flagged Chrome or Bluefy may lack, plus the user agent", () => {
    const bluetooth = { requestDevice: () => Promise.reject(new Error("unused")), getDevices: () => undefined };

    expect(probeLines({ ...base, bluetooth })).toEqual([
      "secure context: yes",
      "navigator.bluetooth: yes",
      "getDevices: yes",
      "requestLEScan: no",
      "writeValueWithoutResponse: yes",
      "userAgent: Bluefy/3.9",
    ]);
  });

  it("says no for every Bluetooth API when navigator.bluetooth is missing", () => {
    const lines = probeLines({ ...base, bluetooth: null, writeWithoutResponse: false });

    expect(lines.slice(1, 5)).toEqual([
      "navigator.bluetooth: no",
      "getDevices: no",
      "requestLEScan: no",
      "writeValueWithoutResponse: no",
    ]);
  });
});
