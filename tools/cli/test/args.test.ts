import { describe, expect, it } from "vitest";
import { UsageError, parseCli } from "../src/args.js";

describe("acemate arguments", () => {
  it("prints help for no command, help, or --help", () => {
    expect(parseCli([])).toEqual({ kind: "help" });
    expect(parseCli(["help"])).toEqual({ kind: "help" });
    expect(parseCli(["listen", "--help"])).toEqual({ kind: "help" });
  });

  it("hands launch its own arguments untouched", () => {
    expect(parseCli(["launch", "single", "--fire"])).toEqual({ kind: "launch", argv: ["single", "--fire"] });
  });

  it("keeps the raw JSON for send as an argument and reads --watch in seconds", () => {
    const parsed = parseCli(["send", '{"type":"ask_init_data"}', "--watch", "8"]);

    expect(parsed).toMatchObject({ kind: "run", command: "send", args: ['{"type":"ask_init_data"}'] });
    expect(parsed.kind === "run" && parsed.options.watchSeconds).toBe(8);
  });

  it("leaves listen unbounded without --watch", () => {
    const parsed = parseCli(["listen"]);

    expect(parsed.kind === "run" && parsed.options.watchSeconds).toBeNull();
  });

  it("rejects unknown commands, unknown flags and non-numeric values", () => {
    expect(() => parseCli(["fly"])).toThrow(UsageError);
    expect(() => parseCli(["listen", "--bogus"])).toThrow(UsageError);
    expect(() => parseCli(["listen", "--watch", "soon"])).toThrow(UsageError);
  });
});
