import { appendFileSync, readFileSync } from "node:fs";
import { createServer, type Server, type ServerResponse } from "node:http";
import { parseArgs } from "node:util";
import { context } from "esbuild";
import { WebSocketServer, type WebSocket } from "ws";
import { parseMessage, requests, type Request } from "../../drive-probe/src/protocol.js";
import { attachControl, type LaunchHooks } from "./control-socket.js";
import { DriveLoop } from "./drive-loop.js";
import { LaunchController } from "./launcher.js";
import { connect, dryRunLink, findFirst, type Link } from "./link.js";
import type { Motion } from "./motion.js";

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    port: { type: "string", default: "8765" },
    chunk: { type: "string", default: "512" },
    heartbeat: { type: "string", default: "3000" },
    log: { type: "string", default: "web-drive.jsonl" },
    "dry-run": { type: "boolean", default: false },
  },
});
const TICK_MS = 10;
const PAGE_DIR = new URL("./page/", import.meta.url);

function record(direction: "tx" | "rx" | "event", payload: unknown): void {
  appendFileSync(String(values.log), `${JSON.stringify({ t: Date.now(), direction, payload })}\n`);
}

function sendLogged(link: Link, request: Request): Promise<void> {
  record("tx", request);
  return link.send(request).catch((error: unknown) => record("event", { writeError: String(error) }));
}

async function openLink(): Promise<Link> {
  if (values["dry-run"]) return dryRunLink();
  console.log("Scanning for the robot (Nordic UART)…");
  const peripheral = await findFirst(15, values.name);
  console.log(`Connecting to ${peripheral.advertisement.localName ?? peripheral.id}…`);
  return connect(peripheral, Number(values.chunk));
}

// Rebuilds the page on every save and keeps the robot connection; open tabs reload via /events.
async function watchPage(onBuild: (script: string) => void): Promise<void> {
  const ctx = await context({
    entryPoints: [new URL("main.ts", PAGE_DIR).pathname],
    bundle: true,
    format: "esm",
    target: "es2022",
    write: false,
    plugins: [
      {
        name: "on-build",
        setup: (b) => {
          b.onEnd((r) => {
            if (r.errors.length === 0) onBuild(r.outputFiles?.[0]?.text ?? "");
          });
        },
      },
    ],
  });
  await ctx.watch();
}

function servePage(getScript: () => string, reloadClients: Set<ServerResponse>): Server {
  return createServer((request, response) => {
    if (request.url === "/") {
      const html = readFileSync(new URL("index.html", PAGE_DIR), "utf8");
      return response.writeHead(200, { "content-type": "text/html" }).end(html);
    }
    if (request.url === "/app.js")
      return response.writeHead(200, { "content-type": "text/javascript" }).end(getScript());
    if (request.url === "/events") return subscribeReload(response, reloadClients);
    response.writeHead(404).end();
  });
}

function subscribeReload(response: ServerResponse, reloadClients: Set<ServerResponse>): void {
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  reloadClients.add(response);
  response.on("close", () => reloadClients.delete(response));
}

function broadcastReload(reloadClients: Set<ServerResponse>): void {
  for (const client of reloadClients) client.write("data: reload\n\n");
}

// One driver at a time: a second tab would fight the first over the robot.
function acceptControl(server: Server, loop: DriveLoop, clients: Set<WebSocket>, launch: LaunchHooks): void {
  const wss = new WebSocketServer({ server, path: "/control" });
  wss.on("connection", (socket) => {
    if (clients.size > 0) return socket.close(1013, "Another page is already driving");
    clients.add(socket);
    record("event", { page: "connected" });
    socket.on("close", () => {
      clients.delete(socket);
      record("event", { page: "closed" });
    });
    attachControl(socket, loop, launch);
    socket.send(JSON.stringify({ sent: loop.motion }));
  });
}

type Waiter = { type: string; resolve: (message: Request | null) => void };

// Routes robot messages: waiters for a reply type, heartbeat car_state to the launcher.
export type CarState = { running?: boolean; bat?: number | null; mode?: string; time_is_set?: boolean } & Record<
  string,
  unknown
>;

// The app sends set_time whenever the heartbeat says the clock is unset (BluetoothService.java:698-703).
function setTimeRequest(): Request {
  return {
    type: "set_time",
    data: {
      unix_timestamp: Math.floor(Date.now() / 1000),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      country_code: "US",
    },
  };
}

function startInbox(link: Link, onCarState: (carState: CarState) => void) {
  const waiters = new Set<Waiter>();
  link.onLine((line) => {
    const message = parseMessage(line) as Request;
    record("rx", message);
    for (const waiter of waiters) if (waiter.type === message.type) waiter.resolve(message);
    const carState = (message.data as { car_state?: CarState } | undefined)?.car_state;
    if (message.type === "rsp_heartbeat" && carState) onCarState(carState);
  });
  return (type: string, timeoutMs: number) =>
    new Promise<Request | null>((resolve) => {
      const waiter: Waiter = { type, resolve: (m) => (waiters.delete(waiter), clearTimeout(timer), resolve(m)) };
      const timer = setTimeout(() => waiter.resolve(null), timeoutMs);
      waiters.add(waiter);
    });
}

function startLauncher(
  link: Link,
  loop: DriveLoop,
  clients: Set<WebSocket>,
): { launcher: LaunchController; hooks: LaunchHooks } {
  const report = (text: string) => {
    record("event", { launch: text });
    for (const client of clients) client.send(JSON.stringify({ launch_status: text }));
  };
  let launcher: LaunchController | null = null;
  let timeSentAt = 0;
  const waitFor = startInbox(link, (carState) => {
    if (carState.time_is_set === false && Date.now() - timeSentAt > 30_000) {
      timeSentAt = Date.now();
      void sendLogged(link, setTimeRequest());
    }
    launcher?.onCarState(carState.running === true, Date.now());
    for (const client of clients) client.send(JSON.stringify({ car_state: carState }));
  });
  launcher = new LaunchController({
    send: (request) => sendLogged(link, request),
    waitFor,
    driveStopped: () => loop.motion === "stop",
    report,
    now: Date.now,
  });
  const active = launcher;
  return { launcher: active, hooks: { onLaunch: (m) => void active.handle(m), blockMotion: () => active.running } };
}

function startLoop(link: Link, clients: Set<WebSocket>): DriveLoop {
  let lastReported: Motion = "stop";
  const loop = new DriveLoop((motion) => {
    void sendLogged(link, requests.motion(motion));
    if (motion === lastReported) return;
    lastReported = motion;
    for (const client of clients) client.send(JSON.stringify({ sent: motion }));
  }, Date.now);
  setInterval(() => loop.tick(), TICK_MS);
  // The stock app skips heartbeats while moving; mirror that.
  setInterval(() => {
    if (loop.motion === "stop") void sendLogged(link, requests.heartbeat());
  }, Number(values.heartbeat));
  return loop;
}

function stopOnExit(link: Link, loop: DriveLoop, launcher: LaunchController): void {
  let exiting = false;
  const shutdown = async (code: number) => {
    if (exiting) return;
    exiting = true;
    loop.release();
    if (launcher.mayBeRunning) await launcher.handle({ kind: "stop" });
    await sendLogged(link, requests.motion("stop"));
    await link.close().catch(() => undefined);
    process.exit(code);
  };
  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));
  process.on("uncaughtException", (error) => {
    console.error(error);
    void shutdown(1);
  });
}

async function main(): Promise<void> {
  const link = await openLink();
  link.onDisconnect(() => {
    console.log("Robot disconnected.");
    record("event", { robot: "disconnected" });
    process.exit(1);
  });
  await sendLogged(link, requests.askInit());
  const clients = new Set<WebSocket>();
  const loop = startLoop(link, clients);
  const { launcher, hooks } = startLauncher(link, loop, clients);
  stopOnExit(link, loop, launcher);
  let script = "";
  const reloadClients = new Set<ServerResponse>();
  await watchPage((next) => {
    const changed = script !== "";
    script = next;
    if (changed) broadcastReload(reloadClients);
  });
  const server = servePage(() => script, reloadClients);
  acceptControl(server, loop, clients, hooks);
  server.listen(Number(values.port), "127.0.0.1", () => {
    console.log(`Connected to ${link.name}. Open http://localhost:${values.port} — Ctrl-C stops the robot and quits.`);
    console.log(`Logging tx/rx to ${values.log}.`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
