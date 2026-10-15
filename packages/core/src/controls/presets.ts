import type { FireMessage } from "../launch/launch-controller";
import type { Ball } from "../protocol/launch";
import { SPANS, snapTo, type Span } from "./ranges";

export type MachinePreset = { name: string; kind: "machine" } & Ball;
export type TargetPreset = { name: string; kind: "target"; x: number; z: number; heightLevel: number; spin: number };
export type Preset = MachinePreset | TargetPreset;

/** Directions use the app's UI convention. */
export const DEFAULT_PRESETS: Preset[] = [
  { name: "Deep feed", kind: "machine", direction: 0, speed: 6, spin: 1, elevation: 22 },
  { name: "Forehand wide", kind: "machine", direction: 10, speed: 6, spin: 1, elevation: 20 },
  { name: "Backhand wide", kind: "machine", direction: -10, speed: 6, spin: 1, elevation: 20 },
  { name: "Body", kind: "machine", direction: 0, speed: 7, spin: 0, elevation: 16 },
  { name: "Moonball", kind: "machine", direction: 0, speed: 5, spin: 3, elevation: 38 },
  { name: "Low slice", kind: "machine", direction: 0, speed: 5, spin: -2, elevation: 14 },
  { name: "Short drop", kind: "machine", direction: 0, speed: 2, spin: -3, elevation: 25 },
  { name: "Lob", kind: "machine", direction: 0, speed: 4, spin: 2, elevation: 40 },
  { name: "Target: deep middle", kind: "target", x: 0, z: 21, heightLevel: 4, spin: 1 },
  { name: "Target: deep right", kind: "target", x: 3.2, z: 21, heightLevel: 4, spin: 1 },
  { name: "Target: deep left", kind: "target", x: -3.2, z: 21, heightLevel: 4, spin: 1 },
  { name: "Target: short angle", kind: "target", x: 3.5, z: 15, heightLevel: 2, spin: 2 },
];

/** A machine preset stores one ball's shape; `count` and `interval` come from the launcher's Balls chip. */
export function presetMessage(preset: Preset, count = 1, interval = 1): FireMessage {
  if (preset.kind === "target") {
    return { kind: "target", x: preset.x, z: preset.z, heightLevel: preset.heightLevel, spin: preset.spin };
  }
  const { direction, speed, spin, elevation } = preset;
  return { kind: "machine", direction, speed, spin, elevation, count, interval };
}

const MACHINE_FIELDS: [keyof Ball, Span][] = [
  ["direction", SPANS.direction],
  ["speed", SPANS.speed],
  ["spin", SPANS.spin],
  ["elevation", SPANS.elevation],
];
// Hand-edited JSON may carry any decimals, so coordinates are only range-checked.
const TARGET_FIELDS: [keyof TargetPreset, Span][] = [
  ["x", { ...SPANS.targetX, step: 0.001 }],
  ["z", { ...SPANS.targetZ, step: 0.001 }],
  ["heightLevel", SPANS.heightLevel],
  ["spin", SPANS.spin],
];

function fieldError(entry: Record<string, unknown>, field: string, span: Span): string | null {
  const value = entry[field];
  if (typeof value !== "number" || snapTo(value, span) !== value) {
    return `${field} must be a number in ${span.min}..${span.max} (step ${span.step})`;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function presetError(record: unknown): string | null {
  if (!isRecord(record)) return "must be an object";
  if (typeof record.name !== "string" || record.name.trim() === "") return "needs a name";
  const fields = record.kind === "machine" ? MACHINE_FIELDS : record.kind === "target" ? TARGET_FIELDS : null;
  if (!fields) return 'kind must be "machine" or "target"';
  for (const [field, span] of fields) {
    const error = fieldError(record, field, span);
    if (error) return error;
  }
  return null;
}

function isPreset(entry: unknown): entry is Preset {
  return presetError(entry) === null;
}

/** Parses the editable preset JSON; rejects the whole list on the first bad entry. */
export function parsePresets(json: string): { presets: Preset[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return { error: `Not JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { error: "Expected a non-empty JSON array of presets." };
  const presets: Preset[] = [];
  for (const [index, entry] of parsed.entries()) {
    if (!isPreset(entry)) return { error: `Preset ${index + 1} ${presetError(entry)}.` };
    presets.push(entry);
  }
  return { presets };
}
