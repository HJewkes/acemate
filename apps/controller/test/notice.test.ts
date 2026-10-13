import { describe, expect, it } from "vitest";
import { launchNotice } from "../src/launcher/notice";

describe("launch notice", () => {
  it("flashes refusals and failures", () => {
    expect(launchNotice("No rsp_set_mode within 3 s; not starting.")).toBe("No rsp_set_mode within 3 s; not starting.");
    expect(launchNotice("Stop driving before launching.")).toBe("Stop driving before launching.");
    expect(launchNotice("run_start failed: write timed out")).toBe("run_start failed: write timed out");
  });

  it("stays quiet for routine progress and when there is no report", () => {
    expect(launchNotice('rsp_set_mode {"result":0}')).toBeNull();
    expect(launchNotice("run_start sent")).toBeNull();
    expect(launchNotice("Run finished (heartbeat running:false)")).toBeNull();
    expect(launchNotice(undefined)).toBeNull();
  });
});
