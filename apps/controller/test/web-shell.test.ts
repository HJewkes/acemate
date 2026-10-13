import { describe, expect, it } from "vitest";
import { computeLayout } from "../src/ui/layout";
import { BEZEL, SHELL_MARGIN, computeWebShell } from "../src/ui/web-shell";

const TALL = 900;

function framed(window: { width: number; height: number }) {
  const shell = computeWebShell({ ...window, pointer: "fine" });
  if (shell.mode !== "framed") throw new Error(`expected framed at ${window.width}x${window.height}`);
  return shell;
}

describe("web shell", () => {
  it("frames the drive screen beside the panel on a laptop window with a mouse", () => {
    const { frame, panel } = framed({ width: 1440, height: 900 });

    expect(frame).toEqual({ width: 956, height: 440 });
    expect(panel).toBe(320);
    expect(frame.width + 2 * BEZEL + panel + 3 * SHELL_MARGIN).toBeLessThanOrEqual(1440);
  });

  it("keeps the full-window layout for touch, however wide the screen", () => {
    expect(computeWebShell({ width: 1440, height: 900, pointer: "coarse" })).toEqual({ mode: "phone" });
  });

  it("keeps the full-window layout on a phone in portrait or landscape", () => {
    expect(computeWebShell({ width: 390, height: 844, pointer: "fine" }).mode).toBe("phone");
    expect(computeWebShell({ width: 844, height: 390, pointer: "coarse" }).mode).toBe("phone");
  });

  it("frames from 1225 px wide, where the shrunk frame still fits the launcher", () => {
    expect(computeWebShell({ width: 1224, height: TALL, pointer: "fine" }).mode).toBe("phone");
    expect(framed({ width: 1225, height: TALL }).frame.height).toBe(374);
  });

  it("frames from 442 px tall", () => {
    expect(computeWebShell({ width: 1440, height: 441, pointer: "fine" }).mode).toBe("phone");
    expect(framed({ width: 1440, height: 442 }).frame.height).toBe(374);
  });

  it("never grows the frame past the phone it stands for", () => {
    expect(framed({ width: 3840, height: 2160 }).frame).toEqual({ width: 956, height: 440 });
  });

  it.each([
    { width: 1225, height: TALL },
    { width: 1280, height: 720 },
    { width: 1440, height: 442 },
    { width: 1920, height: 1080 },
  ])("sizes a frame the drive layout fits at %o", (window) => {
    const { frame } = framed(window);
    const layout = computeLayout(frame);

    expect(layout.column).toBeGreaterThanOrEqual(130);
    expect(layout.column).toBeLessThanOrEqual(260);
    expect(layout.column + 164).toBeLessThanOrEqual(frame.height - 76);
    expect(frame.width / frame.height).toBeCloseTo(956 / 440, 1);
  });
});
