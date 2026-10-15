import { parseArgs } from "node:util";
import {
  LaunchValidationError,
  ballMachine,
  runRequests,
  singleShot,
  targetShot,
  type Ball,
  parseMessage,
  requests,
  type Request,
} from "@acemate/core";
import type { Link } from "./link.js";

export interface LaunchOptions {
  fire: boolean;
  name?: string;
  mock: boolean;
  chunk: number;
  timeoutMs: number;
  watchSeconds: number;
}

export interface LaunchDeps {
  open(options: LaunchOptions): Promise<Link>;
  print(line: string): void;
  record(direction: "tx" | "rx" | "event", payload: unknown): void;
  sleep(ms: number): Promise<void>;
  onInterrupt(handler: () => Promise<void>): void;
}

export const USAGE = [
  "Usage: acemate launch <single|sequence|target> [--fire] [--mock]",
  "  single   --dir D --speed S --spin P --elev E",
  "  sequence --ball D,S,P,E [--ball …] [--interval 5] [--total N]",
  "  target   --x X --z Z --height-level H --spin P",
  "  common   [--name ACEMATE] [--train-id ID] [--timeout 5000] [--watch 20] [--log launch.jsonl]",
  "Dry run by default: prints the JSON and connects to nothing.",
  "--mock fires at a built-in mock robot (ACEMATE-MOCK0) instead of Bluetooth.",
].join("\n");

// The app spaces plain commands at least 200 ms apart (BleCommandSender.java:39).
const COMMAND_SPACING_MS = 200;
const HEARTBEAT_POLL_MS = 1000;

const ARG_OPTIONS = {
  dir: { type: "string" },
  speed: { type: "string" },
  spin: { type: "string" },
  elev: { type: "string" },
  ball: { type: "string", multiple: true },
  interval: { type: "string", default: "5" },
  total: { type: "string" },
  x: { type: "string" },
  z: { type: "string" },
  "height-level": { type: "string" },
  "train-id": { type: "string" },
  fire: { type: "boolean", default: false },
  mock: { type: "boolean", default: false },
  name: { type: "string" },
  chunk: { type: "string", default: "512" },
  timeout: { type: "string", default: "5000" },
  watch: { type: "string", default: "20" },
  log: { type: "string", default: "launch.jsonl" },
} as const;

type ArgValues = ReturnType<typeof parseArgs<{ options: typeof ARG_OPTIONS; allowPositionals: true }>>["values"];

function required(values: ArgValues, key: "dir" | "speed" | "spin" | "elev" | "x" | "z" | "height-level"): number {
  const raw = values[key];
  if (raw === undefined || raw.trim() === "") throw new LaunchValidationError(`--${key} is required`);
  return Number(raw);
}

function parseBall(spec: string): Ball {
  const parts = spec.split(",").map((part) => part.trim());
  if (parts.length !== 4 || parts.some((part) => part === "")) {
    throw new LaunchValidationError(`--ball needs dir,speed,spin,elev; got "${spec}"`);
  }
  const [direction, speed, spin, elevation] = parts.map(Number) as [number, number, number, number];
  return { direction, speed, spin, elevation };
}

function buildSetMode(command: string | undefined, values: ArgValues): Request {
  const trainId = values["train-id"];
  if (command === "single") {
    const ball = {
      direction: required(values, "dir"),
      speed: required(values, "speed"),
      spin: required(values, "spin"),
      elevation: required(values, "elev"),
    };
    return singleShot(ball, trainId);
  }
  if (command === "sequence") {
    const balls = (values.ball ?? []).map(parseBall);
    const totalBalls = values.total === undefined ? undefined : Number(values.total);
    return ballMachine({ balls, totalBalls, interval: Number(values.interval), trainId });
  }
  if (command === "target") {
    return targetShot({
      x: required(values, "x"),
      z: required(values, "z"),
      heightLevel: required(values, "height-level"),
      spin: required(values, "spin"),
      trainId,
    });
  }
  throw new LaunchValidationError(`unknown command "${command ?? ""}"`);
}

export function parseLaunchArgs(argv: string[]): { setMode: Request; options: LaunchOptions; log: string } {
  const { values, positionals } = parseArgs({ args: argv, options: ARG_OPTIONS, allowPositionals: true });
  const options: LaunchOptions = {
    fire: values.fire,
    name: values.name,
    mock: values.mock,
    chunk: Number(values.chunk),
    timeoutMs: Number(values.timeout),
    watchSeconds: Number(values.watch),
  };
  return { setMode: buildSetMode(positionals[0], values), options, log: values.log };
}

export async function runLaunch(setMode: Request, options: LaunchOptions, deps: LaunchDeps): Promise<number> {
  if (!options.fire) {
    printDryRun(setMode, deps.print);
    return 0;
  }
  return fire(setMode, options, deps);
}

function printDryRun(setMode: Request, print: (line: string) => void): void {
  print("DRY RUN: nothing connected. These lines would be sent (each followed by \\r\\n):");
  print(JSON.stringify(requests.askInit()));
  print(JSON.stringify(requests.heartbeat()));
  print(JSON.stringify(setMode));
  print(JSON.stringify(runRequests.start()));
  print(`On Ctrl-C, error or finish: ${JSON.stringify(runRequests.stop())}`);
  print("Add --fire to send them, only on court with the area in front of the robot clear.");
}

interface Inbox {
  expect(type: string, timeoutMs: number): Promise<Request | null>;
}

function createInbox(link: Link, deps: LaunchDeps): Inbox {
  const waiters = new Set<{ type: string; resolve: (message: Request) => void }>();
  link.onLine((line) => {
    const message = parseMessage(line);
    deps.record("rx", message);
    if (message.type !== "rsp_heartbeat") deps.print(`← ${line.slice(0, 300)}`);
    for (const waiter of waiters) if (waiter.type === message.type) waiter.resolve(message);
  });
  return {
    expect: (type, timeoutMs) =>
      new Promise((resolve) => {
        const waiter = { type, resolve: (message: Request | null) => finish(message) };
        const timer = setTimeout(() => finish(null), timeoutMs);
        const finish = (message: Request | null) => {
          clearTimeout(timer);
          waiters.delete(waiter);
          resolve(message);
        };
        waiters.add(waiter);
      }),
  };
}

interface Channel {
  send(request: Request): Promise<void>;
  ask(request: Request, replyType: string): Promise<Request | null>;
}

// Once stopping starts, only run_stop may go out, so a late reply cannot trigger run_start.
function createChannel(link: Link, options: LaunchOptions, deps: LaunchDeps, stopping: () => boolean): Channel {
  const inbox = createInbox(link, deps);
  const send = async (request: Request) => {
    if (stopping() && request.type !== "run_stop") throw new Error(`stopping; not sending ${request.type}`);
    deps.record("tx", request);
    deps.print(`→ ${JSON.stringify(request)}`);
    await link.send(request);
    await deps.sleep(COMMAND_SPACING_MS);
  };
  return {
    send,
    async ask(request, replyType) {
      const reply = inbox.expect(replyType, options.timeoutMs);
      await send(request);
      return reply;
    },
  };
}

function isRunning(heartbeat: Request | null): boolean | undefined {
  const data = heartbeat?.data as { car_state?: { running?: unknown } } | undefined;
  const running = data?.car_state?.running;
  return typeof running === "boolean" ? running : undefined;
}

async function startRoutine(channel: Channel, setMode: Request, deps: LaunchDeps): Promise<void> {
  if (!(await channel.ask(requests.askInit(), "rsp_init_data"))) throw new Error("no rsp_init_data; not launching");
  const running = isRunning(await channel.ask(requests.heartbeat(), "rsp_heartbeat"));
  if (running !== false) throw new Error(`heartbeat running=${String(running)}; need running:false before launching`);
  const reply = await channel.ask(setMode, "rsp_set_mode");
  if (!reply) throw new Error("rsp_set_mode never arrived; not sending run_start");
  deps.record("event", { rsp_set_mode: reply });
  await channel.send(runRequests.start());
}

// Watch until the robot reports the run finished (running seen true, then false) or the watch window ends.
async function watchRun(channel: Channel, options: LaunchOptions, deps: LaunchDeps): Promise<void> {
  let seenRunning = false;
  const polls = Math.ceil((options.watchSeconds * 1000) / HEARTBEAT_POLL_MS);
  for (let poll = 0; poll < polls; poll++) {
    const running = isRunning(await channel.ask(requests.heartbeat(), "rsp_heartbeat"));
    if (running) seenRunning = true;
    if (seenRunning && running === false) {
      deps.print("Run finished.");
      return;
    }
    await deps.sleep(HEARTBEAT_POLL_MS);
  }
  deps.print(`Watch window (${options.watchSeconds}s) ended${seenRunning ? "" : " without seeing running:true"}.`);
}

async function fire(setMode: Request, options: LaunchOptions, deps: LaunchDeps): Promise<number> {
  const link = await deps.open(options);
  let stopping: Promise<void> | null = null;
  const channel = createChannel(link, options, deps, () => stopping !== null);
  const stopAndClose = () =>
    (stopping ??= (async () => {
      await channel.send(runRequests.stop()).catch(() => undefined);
      await link.close().catch(() => undefined);
    })());
  deps.onInterrupt(stopAndClose);
  try {
    await startRoutine(channel, setMode, deps);
    await watchRun(channel, options, deps);
    return 0;
  } catch (error) {
    deps.print(`Aborting: ${error instanceof Error ? error.message : String(error)}`);
    deps.record("event", { abort: String(error) });
    return 1;
  } finally {
    await stopAndClose();
  }
}
