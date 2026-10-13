import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { DEFAULT_HOLD, initialHold, press, tick, type HoldConfig, type HoldState } from "./hold.js";
import { KEY_HELP, keyAction } from "./keys.js";
import { connect, findFirst, scan, type Link } from "./link.js";
import { MOTIONS, parseMessage, requests, type Motion, type Request } from "@acemate/core";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
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
    log: { type: "string", default: "drive-probe.jsonl" },
  },
});
const num = (key: keyof typeof values) => Number(values[key]);

function record(direction: "tx" | "rx" | "event", payload: unknown): void {
  appendFileSync(String(values.log), `${JSON.stringify({ t: Date.now(), direction, payload })}\n`);
}

async function runScan(): Promise<void> {
  console.log("Scanning 10s for devices advertising the Nordic UART service…");
  await scan(10, (p) => {
    console.log(`${p.id}  rssi=${p.rssi}  name=${p.advertisement.localName ?? "?"}`);
    record("event", { discover: p.id, name: p.advertisement.localName, rssi: p.rssi });
  });
}

async function open(): Promise<Link> {
  const peripheral = await findFirst(15, values.name);
  console.log(`Connecting to ${peripheral.advertisement.localName ?? peripheral.id}…`);
  const link = await connect(peripheral, { chunkSize: num("chunk"), withoutResponse: values["no-response"] === true });
  link.onLine((line) => {
    const message = parseMessage(line);
    record("rx", message);
    if (message.type !== "rsp_heartbeat") console.log(`← ${line.slice(0, 300)}`);
  });
  peripheral.on("disconnect", () => {
    console.log("Disconnected.");
    process.exit(1);
  });
  return link;
}

function sendLogged(link: Link, request: Request): Promise<void> {
  record("tx", request);
  return link.send(request);
}

async function runListen(): Promise<void> {
  const link = await open();
  await sendLogged(link, requests.askInit());
  setInterval(() => void sendLogged(link, requests.heartbeat()), num("heartbeat"));
  console.log(`Listening; logging to ${values.log}. Ctrl-C to quit.`);
  process.on("SIGINT", () => void link.close().finally(() => process.exit(0)));
}

async function runDrive(): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error(
      "drive needs an interactive terminal (raw key input); run it in a terminal window, not via `!` or a pipe",
    );
  }
  const link = await open();
  await sendLogged(link, requests.askInit());
  if (values["remote-mode"]) await sendLogged(link, requests.remoteMode());
  const config = holdConfig();
  let hold: HoldState = initialHold();
  const shutdown = once(async () => {
    await sendLogged(link, requests.motion("stop")).catch(() => undefined);
    await link.close().catch(() => undefined);
    process.exit(0);
  });
  startTicker(
    link,
    config,
    () => hold,
    (next) => (hold = next),
  );
  startHeartbeat(link, () => hold.motion === null);
  readKeys((key) => {
    const action = keyAction(key);
    if (action.kind === "quit") void shutdown();
    if (action.kind === "motion") hold = press(hold, action.motion, Date.now(), config);
  });
  setTimeout(() => void shutdown(), num("max-seconds") * 1000);
  console.log(
    `Driving. ${KEY_HELP}\nResend ${config.resendMs}ms; release detected after ${config.repeatHoldMs}ms ` +
      `(${config.initialHoldMs}ms before key-repeat starts).`,
  );
}

function holdConfig(): HoldConfig {
  return {
    ...DEFAULT_HOLD,
    resendMs: num("interval"),
    initialHoldMs: num("initial-hold"),
    repeatHoldMs: num("repeat-hold"),
  };
}

// Scripted move for unattended-terminal tests: pulse <motion[+motion…]> <ms>; a combo alternates each interval.
async function runPulse(): Promise<void> {
  const motions = (positionals[1] ?? "").split("+").map(parseMotion);
  const durationMs = Math.min(Number(positionals[2] ?? 500), 3000);
  const link = await open();
  await sendLogged(link, requests.askInit());
  if (values["remote-mode"]) await sendLogged(link, requests.remoteMode());
  const endAt = Date.now() + durationMs;
  console.log(`Pulsing ${motions.join("+")} for ${durationMs}ms every ${values.interval}ms…`);
  for (let i = 0; Date.now() < endAt; i++) {
    await sendLogged(link, requests.motion(motions[i % motions.length] as Motion));
    await sleep(num("interval"));
  }
  const coastMs = Math.min(num("coast"), 5000);
  if (coastMs > 0) console.log(`Silent for ${coastMs}ms before stop (dead-man test)…`);
  await sleep(coastMs);
  await sendLogged(link, requests.motion("stop"));
  await sleep(num("interval"));
  await sendLogged(link, requests.motion("stop"));
  await sleep(1000);
  await link.close();
  process.exit(0);
}

function parseMotion(value: string | undefined): Motion {
  const motion = MOTIONS.find((m) => m === value && m !== "stop");
  if (!motion) throw new Error(`pulse needs a motion: ${MOTIONS.filter((m) => m !== "stop").join(", ")}`);
  return motion;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Ticks fast so release and direction changes go out at once; tick() rate-limits resends.
function startTicker(link: Link, config: HoldConfig, get: () => HoldState, set: (s: HoldState) => void): void {
  setInterval(() => {
    const { state, send } = tick(get(), Date.now(), config);
    set(state);
    if (send) void sendLogged(link, requests.motion(send));
  }, num("tick"));
}

// The stock app skips heartbeats while moving; mirror that.
function startHeartbeat(link: Link, idle: () => boolean): void {
  setInterval(() => {
    if (idle()) void sendLogged(link, requests.heartbeat());
  }, num("heartbeat"));
}

function readKeys(onKey: (key: string) => void): void {
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (data: string) => onKey(data));
}

function once(fn: () => Promise<void>): () => Promise<void> {
  let started: Promise<void> | null = null;
  return () => (started ??= fn());
}

const commands: Record<string, () => Promise<void>> = {
  scan: runScan,
  listen: runListen,
  drive: runDrive,
  pulse: runPulse,
};
const command = commands[positionals[0] ?? ""];
if (!command) {
  console.log(
    "Usage: drive-probe <scan|listen|drive|pulse <motion> <ms>> [--name S10] [--interval 200] [--repeat-hold 90] [--remote-mode]",
  );
  process.exit(2);
}
command().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
