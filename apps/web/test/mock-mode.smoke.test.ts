// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import html from "../index.html?raw";

const text = (id: string) => document.getElementById(id)?.textContent ?? "";
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function press(code: string, type: "keydown" | "keyup" = "keydown"): void {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

describe("mock mode (?mock=1)", () => {
  beforeAll(async () => {
    history.replaceState(null, "", "/?mock=1");
    // The page's own <script> is dropped; the test imports main directly.
    document.body.innerHTML = (/<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "").replace(
      /<script[\s\S]*?<\/script>/g,
      "",
    );
    await import("../src/main.js");
  });

  it("connects to the pretend robot on Connect and shows its name and init data", async () => {
    expect(text("sent")).toBe("nothing");

    document.getElementById("connect")?.click();
    await settle(80);

    expect(text("robot")).toBe("ACEMATE-MOCK0");
    expect(text("connect")).toBe("Disconnect");
    expect(text("l-status")).toContain("rsp_init_data");
  });

  it("drives from the keyboard and stops when the window loses focus", async () => {
    press("KeyW");
    await settle(20);
    const driving = text("sent");

    window.dispatchEvent(new Event("blur"));
    press("KeyW", "keyup");
    await settle(20);

    expect(driving).toBe("go_front");
    expect(text("sent")).toBe("stop");
  });

  it("never drives from keys typed into a launcher field", async () => {
    document.getElementById("l-speed")?.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }));
    await settle(20);

    expect(text("sent")).toBe("stop");
  });

  it("does not auto-reconnect after Disconnect", async () => {
    document.getElementById("connect")?.click();
    await settle(80);

    expect(text("robot")).toContain("disconnected");
    expect(text("connect")).toBe("Connect");
  });
});
