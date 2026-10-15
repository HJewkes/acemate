import { LaunchValidationError } from "@acemate/core";
import { USAGE, UsageError, parseCli, type Command } from "./args.js";
import { runDrive, runListen, runPulse, runScan, type Probe } from "./drive.js";
import { USAGE as LAUNCH_USAGE, parseLaunchArgs, runLaunch } from "./launch.js";
import { runSend } from "./send.js";
import { openLink, recorder, sleep } from "./session.js";

const print = (line: string) => console.log(line);

function launch(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    print(LAUNCH_USAGE);
    return Promise.resolve(0);
  }
  const { setMode, options, log } = parseLaunchArgs(argv);
  return runLaunch(setMode, options, {
    open: (o) => openLink({ name: o.name, chunk: o.chunk, noResponse: false, mock: o.mock }),
    print,
    record: recorder(log),
    sleep,
    onInterrupt: (stop) => process.on("SIGINT", () => void stop().finally(() => process.exit(130))),
  });
}

function send(probe: Probe): Promise<number> {
  const deps = { open: () => openLink(probe.options), print, record: probe.record, sleep };
  return runSend(probe.args[0] ?? "", probe.options.watchSeconds, deps);
}

const COMMANDS: Record<Command, (probe: Probe) => Promise<number>> = {
  scan: runScan,
  listen: runListen,
  drive: runDrive,
  pulse: runPulse,
  send,
};

async function main(argv: string[]): Promise<number> {
  const parsed = parseCli(argv);
  if (parsed.kind === "help") {
    print(USAGE);
    return 0;
  }
  if (parsed.kind === "launch") return launch(parsed.argv);
  const { command, args, options } = parsed;
  return COMMANDS[command]({ options, args, record: recorder(options.log) });
}

function exitCodeFor(error: unknown): number {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }
  if (error instanceof LaunchValidationError) {
    console.error(`Rejected: ${error.message}\n${LAUNCH_USAGE}`);
    return 2;
  }
  console.error(error);
  return 1;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => process.exit(exitCodeFor(error)),
);
