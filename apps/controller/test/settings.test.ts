import { describe, expect, it } from "vitest";
import { DEFAULT_SHOT } from "../src/launcher/shot";
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, parseSettings, saveSettings, type KeyValueStore } from "../src/storage/settings";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: async (key) => data[key] ?? null,
    setItem: async (key, value) => void (data[key] = value),
  };
}

describe("settings", () => {
  it("round-trips the stick mode, aim, last robot and theme", async () => {
    const store = memoryStore();
    const saved = {
      horizontal: "turn" as const,
      shot: { ...DEFAULT_SHOT, direction: -7, elevation: 31, speed: 8, spin: 2 },
      lastRobot: { id: "B1F2-ROBOT", name: "ACEMATE-XXXXX" },
      theme: "light" as const,
      allowDriveDuringRun: true,
    };

    await saveSettings(store, saved);

    expect(await loadSettings(store)).toEqual(saved);
  });

  it("falls back to defaults for missing or corrupt storage", async () => {
    expect(await loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid fields and defaults the malformed ones", () => {
    const parsed = parseSettings(JSON.stringify({ horizontal: "sideways", shot: { speed: 9, spin: "lots" }, lastRobot: { id: "" } }));

    expect(parsed.horizontal).toBe("strafe");
    expect(parsed.shot.speed).toBe(9);
    expect(parsed.shot.spin).toBe(DEFAULT_SHOT.spin);
    expect(parsed.lastRobot).toBeNull();
  });

  it("defaults to the dark theme when the stored theme is missing or unknown", () => {
    const olderShape = parseSettings(JSON.stringify({ horizontal: "turn" }));
    const unknown = parseSettings(JSON.stringify({ horizontal: "turn", theme: "sepia" }));

    expect(DEFAULT_SETTINGS.theme).toBe("dark");
    expect(olderShape.theme).toBe("dark");
    expect(unknown.theme).toBe("dark");
    expect(unknown.horizontal).toBe("turn");
  });

  it("keeps driving during runs off unless it was saved as exactly true", async () => {
    const store = memoryStore();
    await saveSettings(store, { ...DEFAULT_SETTINGS, allowDriveDuringRun: true });

    expect(DEFAULT_SETTINGS.allowDriveDuringRun).toBe(false);
    expect((await loadSettings(store)).allowDriveDuringRun).toBe(true);
    expect(parseSettings(JSON.stringify({ allowDriveDuringRun: "yes" })).allowDriveDuringRun).toBe(false);
    expect(parseSettings(JSON.stringify({ theme: "light" })).allowDriveDuringRun).toBe(false);
  });

  it("treats an unreadable store as empty rather than failing", async () => {
    const broken: KeyValueStore = { getItem: () => Promise.reject(new Error("io")), setItem: () => Promise.reject(new Error("io")) };

    expect(await loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    await expect(saveSettings(broken, DEFAULT_SETTINGS)).resolves.toBeUndefined();
    expect(SETTINGS_KEY).toBe("acemate.settings.v1");
  });
});
