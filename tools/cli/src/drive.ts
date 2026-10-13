import { MOTIONS, parseMessage, requests, type Motion, type Request } from "@acemate/core";
import type { CliOptions } from "./args.js";
import { DEFAULT_HOLD, initialHold, press, tick, type HoldConfig, type HoldState } from "./hold.js";
import { KEY_HELP, keyAction } from "./keys.js";
import type { Link } from "./link.js";
import { openLink, sleep, type Recorder } from "./session.js";

export interface Probe {
  options: CliOptions;
  args: string[];
  record: Recorder;
}

const forever = () => new Promise<never>(() => undefined);

export async function runScan({ record }: Probe): Promise<number> {
  const { scan } = await import("./link.js");
  console.log("Scanning 10s for devices advertising the Nordic UART service…");
  await scan(10, (p) => {
    console.log(`${p.id}  rssi=${p.rssi}  name=${p.advertisement.localName ?? "?"}`);
    record("event", { discover: p.id, name: p.advertisement.localName, rssi: p.rssi });
  });
  return 0;
}

async function open({ options, record }: Probe, showHeartbeats = false): Promise<Link> {
  const link = await openLink(options);
  link.onLine((line) => {
    const message = parseMessage(line);
    record("rx", message);
    if (showHeartbeats || message.type !== "rsp_heartbeat") console.log(`← ${line.slice(0, 300)}`);
  });
  return link;
}

function sendLogged(probe: Probe, link: Link, request: Request): Promise<void> {
  probe.record("tx", request);
  return link.send(request);
}

export async function runListen(probe: Probe): Promise<number> {
  const { watchSeconds, heartbeat, log } = probe.options;
  const link = await open(probe, watchSeconds !== null);
  await sendLogged(probe, link, requests.askInit());
  setInterval(() => void sendLogged(probe, link, requests.heartbeat()), heartbeat);
  process.on("SIGINT", () => void link.close().finally(() => process.exit(0)));
  if (watchSeconds === null) {
    console.log(`Listening; logging to ${log}. Ctrl-C to quit.`);
    return forever();
  }
  console.log(`Watching every frame for ${watchSeconds}s; logging to ${log}.`);
  await sleep(watchSeconds * 1000);
  await link.close();
  return 0;
}

export async function runDrive(probe: Probe): Promise<number> {
  if (!process.stdin.isTTY) {
    throw new Error("drive needs an interactive terminal (raw key input); run it in a terminal window, not a pipe");
  }
  const link = await open(probe);
  await sendLogged(probe, link, requests.askInit());
  if (probe.options.remoteMode) await sendLogged(probe, link, requests.remoteMode());
  const config = holdConfig(probe.options);
  let hold: HoldState = initialHold();
  const shutdown = once(async () => {
    await sendLogged(probe, link, requests.motion("stop")).catch(() => undefined);
    await link.close().catch(() => undefined);
    process.exit(0);
  });
  startTicker(probe, link, config, (now) => {
    const { state, send } = tick(hold, now, config);
    hold = state;
    return send;
  });
  startHeartbeat(probe, link, () => hold.motion === null);
  readKeys((key) => {
    const action = keyAction(key);
    if (action.kind === "quit") void shutdown();
    if (action.kind === "motion") hold = press(hold, action.motion, Date.now(), config);
  });
  setTimeout(() => void shutdown(), probe.options.maxSeconds * 1000);
  console.log(`Driving. ${KEY_HELP}\nResend ${config.resendMs}ms; release detected after ${config.repeatHoldMs}ms.`);
  return forever();
}

function holdConfig(options: CliOptions): HoldConfig {
  return {
    ...DEFAULT_HOLD,
    resendMs: options.interval,
    initialHoldMs: options.initialHold,
    repeatHoldMs: options.repeatHold,
  };
}

// Scripted move for unattended-terminal tests: pulse <motion[+motion…]> <ms>; a combo alternates each interval.
export async function runPulse(probe: Probe): Promise<number> {
  const { interval, coast, remoteMode } = probe.options;
  const motions = (probe.args[0] ?? "").split("+").map(parseMotion);
  const durationMs = Math.min(Number(probe.args[1] ?? 500), 3000);
  const link = await open(probe);
  await sendLogged(probe, link, requests.askInit());
  if (remoteMode) await sendLogged(probe, link, requests.remoteMode());
  const endAt = Date.now() + durationMs;
  console.log(`Pulsing ${motions.join("+")} for ${durationMs}ms every ${interval}ms…`);
  for (let i = 0; Date.now() < endAt; i++) {
    await sendLogged(probe, link, requests.motion(motions[i % motions.length] ?? "stop"));
    await sleep(interval);
  }
  const coastMs = Math.min(coast, 5000);
  if (coastMs > 0) console.log(`Silent for ${coastMs}ms before stop (dead-man test)…`);
  await sleep(coastMs);
  for (const wait of [interval, 1000]) {
    await sendLogged(probe, link, requests.motion("stop"));
    await sleep(wait);
  }
  await link.close();
  return 0;
}

function parseMotion(value: string): Motion {
  const motion = MOTIONS.find((m) => m === value && m !== "stop");
  if (!motion) throw new Error(`pulse needs a motion: ${MOTIONS.filter((m) => m !== "stop").join(", ")}`);
  return motion;
}

// Ticks fast so release and direction changes go out at once; tick() rate-limits resends.
function startTicker(probe: Probe, link: Link, config: HoldConfig, next: (now: number) => Motion | null): void {
  setInterval(() => {
    const send = next(Date.now());
    if (send) void sendLogged(probe, link, requests.motion(send));
  }, probe.options.tick);
}

// The stock app skips heartbeats while moving; mirror that.
function startHeartbeat(probe: Probe, link: Link, idle: () => boolean): void {
  setInterval(() => {
    if (idle()) void sendLogged(probe, link, requests.heartbeat());
  }, probe.options.heartbeat);
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
