import type { Horizontal } from "../control/sticks";
import { DEFAULT_SHOT, type Shot } from "../launcher/shot";
import { DRIVE_MODES, type DriveMode } from "../robot/drive-mode";
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
  /** Which path the stick drives; the two besides stock are beta. */
  driveMode: DriveMode;
  /** Longest line written without response; the web debug menu lowers it if Android keeps a 23-byte MTU. */
  maxUnackedWrite: UnackedLimit;
}

export const UNACKED_LIMITS = [180, 100, 20] as const;
export type UnackedLimit = (typeof UNACKED_LIMITS)[number];

export const SETTINGS_KEY = "acemate.settings.v1";
export const DEFAULT_SETTINGS: Settings = {
  horizontal: "strafe",
  shot: DEFAULT_SHOT,
  lastRobot: null,
  theme: "dark",
  allowDriveDuringRun: false,
  driveMode: "stock",
  maxUnackedWrite: 180,
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

// Before the mode selector, the wheel path was a boolean advancedDrive setting.
function parseDriveMode(value: Partial<Record<string, unknown>>): DriveMode {
  const saved = DRIVE_MODES.find((mode) => mode === value.driveMode);
  if (saved) return saved;
  return value.advancedDrive === true ? "wheel" : "stock";
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
    const value = JSON.parse(raw) as Partial<Record<keyof Settings | "advancedDrive", unknown>>;
    return {
      horizontal: value.horizontal === "turn" ? "turn" : "strafe",
      shot: parseShot(value.shot),
      lastRobot: parseRobot(value.lastRobot),
      theme: value.theme === "light" ? "light" : "dark",
      allowDriveDuringRun: value.allowDriveDuringRun === true,
      driveMode: parseDriveMode(value),
      maxUnackedWrite:
        UNACKED_LIMITS.find((limit) => limit === value.maxUnackedWrite) ?? DEFAULT_SETTINGS.maxUnackedWrite,
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
