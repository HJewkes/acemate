import { appendFileSync } from "node:fs";
import type { CliOptions } from "./args.js";
import type { Link } from "./link.js";

export type Direction = "tx" | "rx" | "event";
export type Recorder = (direction: Direction, payload: unknown) => void;

export function recorder(log: string): Recorder {
  return (direction, payload) => appendFileSync(log, `${JSON.stringify({ t: Date.now(), direction, payload })}\n`);
}

// link.js loads noble, so import it only when connecting; help, dry runs and refusals never touch Bluetooth.
export async function openLink(options: Pick<CliOptions, "name" | "chunk" | "noResponse">): Promise<Link> {
  const { connect, findFirst } = await import("./link.js");
  const peripheral = await findFirst(15, options.name);
  console.log(`Connecting to ${peripheral.advertisement.localName ?? peripheral.id}…`);
  const link = await connect(peripheral, { chunkSize: options.chunk, withoutResponse: options.noResponse });
  peripheral.on("disconnect", () => {
    console.log("Disconnected.");
    process.exit(1);
  });
  return link;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
