import { MAX_TOTAL_BALLS, type Ball } from "../../../../tools/drive-probe/src/launch.js";
import { SPANS, snapTo, type Span } from "./ranges.js";
import type { FireMessage } from "./variant.js";

export type MachinePreset = { name: string; kind: "machine" } & Ball;
export type TargetPreset = { name: string; kind: "target"; x: number; z: number; heightLevel: number; spin: number };
export type Preset = MachinePreset | TargetPreset;

/** Edit freely: the page's "Edit presets" box starts from this list. Directions use the app's UI convention. */
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

export const MAX_QUEUE = MAX_TOTAL_BALLS;

export function presetMessage(preset: Preset): FireMessage {
  if (preset.kind === "target") {
    return { kind: "target", x: preset.x, z: preset.z, heightLevel: preset.heightLevel, spin: preset.spin };
  }
  const { direction, speed, spin, elevation } = preset;
  return { kind: "machine", direction, speed, spin, elevation, count: 1, interval: 1 };
}

/** Why a preset cannot join the queue, or null if it can. */
export function queueRefusal(queue: readonly Preset[], preset: Preset): string | null {
  if (preset.kind === "target") return "Target presets fire on their own: one drill set_mode carries one target here.";
  if (queue.length >= MAX_QUEUE) return `The queue holds at most ${MAX_QUEUE} balls.`;
  return null;
}

/** The whole queue as one ball_machine set_mode: b:[...] in tap order, total_balls = queue length. */
export function queueMessage(queue: readonly Preset[], interval: number): FireMessage | null {
  const balls = queue.filter((preset): preset is MachinePreset => preset.kind === "machine");
  if (balls.length === 0) return null;
  return {
    kind: "machine-queue",
    balls: balls.map(({ direction, speed, spin, elevation }) => ({ direction, speed, spin, elevation })),
    interval,
  };
}

const MACHINE_FIELDS: [keyof Ball, Span][] = [
  ["direction", SPANS.direction],
  ["speed", SPANS.speed],
  ["spin", SPANS.spin],
  ["elevation", SPANS.elevation],
];
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

function presetError(entry: unknown): string | null {
  if (typeof entry !== "object" || entry === null) return "must be an object";
  const record = entry as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name.trim() === "") return "needs a name";
  const fields = record.kind === "machine" ? MACHINE_FIELDS : record.kind === "target" ? TARGET_FIELDS : null;
  if (!fields) return 'kind must be "machine" or "target"';
  for (const [field, span] of fields) {
    const error = fieldError(record, field, span);
    if (error) return error;
  }
  return null;
}

/** Parses the editable preset JSON; rejects the whole list on the first bad entry. */
export function parsePresets(json: string): { presets: Preset[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return { error: `Not JSON: ${(error as Error).message}` };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { error: "Expected a non-empty JSON array of presets." };
  for (const [index, entry] of parsed.entries()) {
    const error = presetError(entry);
    if (error) return { error: `Preset ${index + 1} ${error}.` };
  }
  return { presets: parsed as Preset[] };
}
