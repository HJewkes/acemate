import { parseMessage, requests, type Request } from "@acemate/core";
import type { Link } from "./link.js";

interface Rule {
  reason: string;
  matches(type: string, texts: readonly string[]): boolean;
}

const OTA_WORD = /(^|[^a-z])ota([^a-z]|$)/i;
const anyText = (pattern: RegExp) => (_type: string, texts: readonly string[]) => texts.some((t) => pattern.test(t));

// Never sent from here, whatever the experiment: each one can brick the robot or wreck its localisation.
const DENYLIST: readonly Rule[] = [
  {
    reason: "OTA (mcu_ota, ap purpose ota, any type containing 'ota') can flash firmware and brick the robot",
    matches: (type, texts) => type.toLowerCase().includes("ota") || texts.some((t) => OTA_WORD.test(t)),
  },
  {
    reason: "upload and trigger_update are the OTA paths on the robot's HTTP server",
    matches: anyText(/upload|trigger_update/i),
  },
  {
    reason: "start_calib_extrinsic overwrites the camera calibration that localisation depends on",
    matches: anyText(/start_calib_extrinsic/i),
  },
  {
    reason: "set_court_profile replaces the court model used for localisation and targeting",
    matches: anyText(/set_court_profile/i),
  },
];

function texts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(texts);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...texts(inner)]);
  }
  return [];
}

export function refusal(request: Request): string | null {
  const all = texts(request);
  return DENYLIST.find((rule) => rule.matches(request.type, all))?.reason ?? null;
}

function parseRawRequest(text: string): Request {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`not valid JSON: ${text}`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("send needs a JSON object");
  if (!("type" in value) || typeof value.type !== "string") throw new Error('send needs a string "type" field');
  return { ...value, type: value.type };
}

export interface SendDeps {
  open(): Promise<Link>;
  print(line: string): void;
  record(direction: "tx" | "rx" | "event", payload: unknown): void;
  sleep(ms: number): Promise<void>;
}

const DEFAULT_WATCH_SECONDS = 5;
// The app spaces plain commands at least 200 ms apart (BleCommandSender.java:39).
const COMMAND_SPACING_MS = 200;

export async function runSend(text: string, watchSeconds: number | null, deps: SendDeps): Promise<number> {
  let request: Request;
  try {
    request = parseRawRequest(text);
  } catch (error) {
    deps.print(`Not sent: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  const reason = refusal(request);
  if (reason) {
    deps.print(`Refused "${request.type}", not sent: ${reason}.`);
    return 2;
  }
  await exchange(request, (watchSeconds ?? DEFAULT_WATCH_SECONDS) * 1000, deps);
  return 0;
}

async function exchange(request: Request, watchMs: number, deps: SendDeps): Promise<void> {
  const link = await deps.open();
  link.onLine((line) => {
    deps.record("rx", parseMessage(line));
    deps.print(`← ${line}`);
  });
  for (const next of [requests.askInit(), request]) {
    deps.record("tx", next);
    deps.print(`→ ${JSON.stringify(next)}`);
    await link.send(next);
    await deps.sleep(COMMAND_SPACING_MS);
  }
  await deps.sleep(watchMs);
  await link.close();
}
