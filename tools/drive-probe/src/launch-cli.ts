import { appendFileSync } from "node:fs";
import { LaunchValidationError } from "@acemate/core";
import { USAGE, parseLaunchArgs, runLaunch, type LaunchDeps, type LaunchOptions } from "./launch-session.js";
import type { Link } from "./link.js";

function parse(): ReturnType<typeof parseLaunchArgs> {
  try {
    return parseLaunchArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof LaunchValidationError ? `Rejected: ${error.message}` : error);
    console.error(USAGE);
    process.exit(2);
  }
}

// link.js loads noble, so import it only when firing; a dry run never touches Bluetooth.
async function open(options: LaunchOptions): Promise<Link> {
  const { connect, findFirst } = await import("./link.js");
  const peripheral = await findFirst(15, options.name);
  console.log(`Connecting to ${peripheral.advertisement.localName ?? peripheral.id}…`);
  const link = await connect(peripheral, { chunkSize: options.chunk, withoutResponse: false });
  peripheral.on("disconnect", () => {
    console.log("Disconnected (no further run_stop possible).");
    process.exit(1);
  });
  return link;
}

const { setMode, options, log } = parse();
const deps: LaunchDeps = {
  open,
  print: (line) => console.log(line),
  record: (direction, payload) => appendFileSync(log, `${JSON.stringify({ t: Date.now(), direction, payload })}\n`),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  onInterrupt: (stop) => process.on("SIGINT", () => void stop().finally(() => process.exit(130))),
};
runLaunch(setMode, options, deps)
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
