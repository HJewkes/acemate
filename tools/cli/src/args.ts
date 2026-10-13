import { parseArgs } from "node:util";

export type Command = "scan" | "listen" | "drive" | "pulse" | "send";

export interface CliOptions {
  name?: string;
  interval: number;
  initialHold: number;
  repeatHold: number;
  tick: number;
  heartbeat: number;
  maxSeconds: number;
  chunk: number;
  remoteMode: boolean;
  noResponse: boolean;
  coast: number;
  log: string;
  watchSeconds: number | null;
}

export type ParsedCli =
  | { kind: "help" }
  | { kind: "launch"; argv: string[] }
  | { kind: "run"; command: Command; args: string[]; options: CliOptions };

export class UsageError extends Error {}

export const USAGE = [
  "Usage: acemate <command> [options]",
  "  scan                            list nearby robots for 10 s",
  "  listen [--watch S]              print what the robot sends; --watch adds heartbeats and exits after S s",
  "  drive                           drive from the keyboard (needs an interactive terminal)",
  "  pulse <motion[+motion]> <ms>    scripted move, at most 3000 ms",
  "  send '<json>' [--watch S]       write one raw request and print every reply for S s (default 5)",
  "  launch <single|sequence|target> dry run unless --fire; `acemate launch --help` for its options",
  "Options: [--name ACEMATE] [--interval 200] [--initial-hold 300] [--repeat-hold 90] [--tick 20]",
  "         [--heartbeat 3000] [--max-seconds 120] [--chunk 512] [--remote-mode] [--no-response]",
  "         [--coast 0] [--log acemate.jsonl]",
].join("\n");

const OPTIONS = {
  name: { type: "string" },
  interval: { type: "string", default: "200" },
  "initial-hold": { type: "string", default: "300" },
  "repeat-hold": { type: "string", default: "90" },
  tick: { type: "string", default: "20" },
  heartbeat: { type: "string", default: "3000" },
  "max-seconds": { type: "string", default: "120" },
  chunk: { type: "string", default: "512" },
  "remote-mode": { type: "boolean", default: false },
  "no-response": { type: "boolean", default: false },
  coast: { type: "string", default: "0" },
  log: { type: "string", default: "acemate.jsonl" },
  watch: { type: "string" },
  help: { type: "boolean", short: "h", default: false },
} as const;

const COMMANDS: readonly string[] = ["scan", "listen", "drive", "pulse", "send"] satisfies Command[];
const isCommand = (value: string | undefined): value is Command => value !== undefined && COMMANDS.includes(value);

function number(flag: string, raw: string): number {
  const value = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(value) || value < 0) {
    throw new UsageError(`--${flag} needs a non-negative number; got "${raw}"`);
  }
  return value;
}

export function parseCli(argv: string[]): ParsedCli {
  if (argv[0] === "launch") return { kind: "launch", argv: argv.slice(1) };
  const { values, positionals } = parseOrThrow(argv);
  const [command, ...args] = positionals;
  if (values.help || command === undefined || command === "help") return { kind: "help" };
  if (!isCommand(command)) throw new UsageError(`unknown command "${command}"`);
  return { kind: "run", command, args, options: toOptions(values) };
}

function parseOrThrow(argv: string[]) {
  try {
    return parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

function toOptions(values: ReturnType<typeof parseOrThrow>["values"]): CliOptions {
  return {
    name: values.name,
    interval: number("interval", values.interval),
    initialHold: number("initial-hold", values["initial-hold"]),
    repeatHold: number("repeat-hold", values["repeat-hold"]),
    tick: number("tick", values.tick),
    heartbeat: number("heartbeat", values.heartbeat),
    maxSeconds: number("max-seconds", values["max-seconds"]),
    chunk: number("chunk", values.chunk),
    remoteMode: values["remote-mode"],
    noResponse: values["no-response"],
    coast: number("coast", values.coast),
    log: values.log,
    watchSeconds: values.watch === undefined ? null : number("watch", values.watch),
  };
}
