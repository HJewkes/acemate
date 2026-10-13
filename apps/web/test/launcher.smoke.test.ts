// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import html from "../index.html?raw";
import { HOLD_MS } from "../src/launcher-ui/hold-fire.js";

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const text = (id: string) => byId(id)?.textContent ?? "";
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fire = () => byId<HTMLButtonElement>("l-fire");
const down = () => fire().dispatchEvent(new PointerEvent("pointerdown", { pointerId: 3, button: 0, bubbles: true }));
const up = () => fire().dispatchEvent(new PointerEvent("pointerup", { pointerId: 3, button: 0, bubbles: true }));

function switchTo(label: string): void {
  const button = [...document.querySelectorAll<HTMLButtonElement>("#launcher-switch button")].find((b) => b.textContent?.includes(label));
  button?.click();
}

describe("launcher variants in mock mode", () => {
  beforeAll(async () => {
    history.replaceState(null, "", "/?mock=1&launcher=c");
    document.body.innerHTML = (/<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "").replace(/<script[\s\S]*?<\/script>/g, "");
    await import("../src/main.js");
  });

  it("opens the variant named in ?launcher", () => {
    expect(byId("launcher-variant").dataset.variant).toBe("c");
    expect(document.querySelector(".pad")).not.toBeNull();
  });

  it("switches variants from the segmented control and remembers the choice", () => {
    switchTo("Court map");

    expect(byId("launcher-variant").dataset.variant).toBe("b");
    expect(document.querySelector("svg.court")).not.toBeNull();
    expect(localStorage.getItem("acemate.launcher.variant")).toBe("b");
    expect(new URLSearchParams(location.search).get("launcher")).toBe("b");
  });

  it("keeps Fire disabled until connected", async () => {
    expect(fire().disabled).toBe(true);

    byId("connect").click();
    await settle(80);
    expect(fire().disabled).toBe(false);
  });

  it("does not fire on a tap or an early release", async () => {
    down();
    await settle(200);
    up();
    fire().click();
    await settle(HOLD_MS);

    expect(text("l-status")).not.toContain("run_start sent");
  });

  it("fires once after a full hold with no arming, then blocks Fire while the run is active", async () => {
    down();
    await settle(HOLD_MS + 250);
    up();
    await settle(100);

    expect(text("l-status").match(/run_start sent/g)).toHaveLength(1);
    expect(fire().disabled).toBe(true);
    down();
    await settle(HOLD_MS + 250);
    up();
    expect(text("l-status").match(/run_start sent/g)).toHaveLength(1);
  });

  it("cancels a hold in progress on Space and sends run_stop", async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true }));
    await settle(80);

    expect(text("l-status")).toContain("run_stop sent");
  });

  it("cancels a hold on window blur and ignores Enter auto-repeat", async () => {
    const before = text("l-status").match(/run_start sent/g)?.length ?? 0;
    down();
    await settle(400);
    window.dispatchEvent(new Event("blur"));
    expect(fire().style.getPropertyValue("--hold")).toBe("0");
    up();
    fire().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true }));
    await settle(HOLD_MS + 250);

    expect(text("l-status").match(/run_start sent/g)?.length ?? 0).toBe(before);
  });

  it("fires from a held Enter on the focused button", async () => {
    const before = text("l-status").match(/run_start sent/g)?.length ?? 0;
    fire().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle(HOLD_MS + 250);
    fire().dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));

    expect(text("l-status").match(/run_start sent/g)?.length ?? 0).toBe(before + 1);
    byId("l-stop").click();
    await settle(100);
  });

  it("never drives while a pointer is down in the launcher, and drives again once it lifts", async () => {
    switchTo("Aim pad");
    const pad = document.querySelector<HTMLElement>(".pad")!;
    pad.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 7, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }));
    await settle(80);
    const whileAiming = text("sent");

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7, bubbles: true }));
    await settle(80);
    const afterLift = text("sent");
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", bubbles: true }));
    await settle(80);

    expect(whileAiming).not.toMatch(/go_/);
    expect(afterLift).toBe("go_front");
  });

  it("ignores drive keys aimed at the aim pad", async () => {
    const pad = document.querySelector<HTMLElement>(".pad")!;
    pad.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }));
    await settle(80);

    expect(text("sent")).not.toMatch(/go_/);
  });
});
