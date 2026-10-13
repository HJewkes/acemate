import type { Horizontal } from "../control/sticks";
import { DEFAULT_SHOT, type Shot } from "../launcher/shot";
import type { ThemeName } from "../ui/theme";

/** The slice of AsyncStorage this needs, so tests can pass an in-memory map. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface SavedRobot {
  id: string;
  name: string;
}

export interface Settings {
  horizontal: Horizontal;
  shot: Shot;
  lastRobot: SavedRobot | null;
  theme: ThemeName;
  /** Lets the stick drive while a launch run is active; firing still needs the robot stopped. */
  allowDriveDuringRun: boolean;
}

export const SETTINGS_KEY = "acemate.settings.v1";
export const DEFAULT_SETTINGS: Settings = {
  horizontal: "strafe",
  shot: DEFAULT_SHOT,
  lastRobot: null,
  theme: "dark",
  allowDriveDuringRun: false,
};

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function parseShot(value: unknown): Shot {
  const shot = value as Partial<Record<keyof Shot, unknown>> | null;
  if (!shot || typeof shot !== "object") return DEFAULT_SHOT;
  const pick = (key: keyof Shot) => (isNumber(shot[key]) ? (shot[key] as number) : DEFAULT_SHOT[key]);
  return {
    ...DEFAULT_SHOT,
    direction: pick("direction"),
    elevation: pick("elevation"),
    speed: pick("speed"),
    spin: pick("spin"),
  };
}

function parseRobot(value: unknown): SavedRobot | null {
  const robot = value as Partial<SavedRobot> | null;
  if (!robot || typeof robot.id !== "string" || robot.id.length === 0) return null;
  return { id: robot.id, name: typeof robot.name === "string" ? robot.name : robot.id };
}

/** Anything missing, malformed or from an older shape falls back to the defaults, field by field. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    return {
      horizontal: value.horizontal === "turn" ? "turn" : "strafe",
      shot: parseShot(value.shot),
      lastRobot: parseRobot(value.lastRobot),
      theme: value.theme === "light" ? "light" : "dark",
      allowDriveDuringRun: value.allowDriveDuringRun === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function loadSettings(store: KeyValueStore): Promise<Settings> {
  return parseSettings(await store.getItem(SETTINGS_KEY).catch(() => null));
}

export async function saveSettings(store: KeyValueStore, settings: Settings): Promise<void> {
  await store.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => undefined);
}
