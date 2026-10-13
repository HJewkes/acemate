import type { LaunchMessage } from "../launcher.js";

type Send = (message: LaunchMessage) => void;

const field = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function machineMessage(): LaunchMessage {
  return {
    kind: "machine",
    direction: field("l-dir"),
    speed: field("l-speed"),
    spin: field("l-spin"),
    elevation: field("l-elev"),
    count: field("l-count"),
    interval: field("l-interval"),
  };
}

function targetMessage(): LaunchMessage {
  return { kind: "target", x: field("t-x"), z: field("t-z"), heightLevel: field("t-height"), spin: field("t-spin") };
}

// Firing needs a fresh tick of "armed" each time, so a stray click can't launch twice.
function fireWith(build: () => LaunchMessage, send: Send): () => void {
  return () => {
    const armed = element<HTMLInputElement>("l-armed");
    if (!armed.checked) return showLaunchStatus("Tick 'armed' first.");
    armed.checked = false;
    send(build());
  };
}

export function showLaunchStatus(text: string): void {
  const log = element<HTMLElement>("l-status");
  log.textContent = `${new Date().toLocaleTimeString()}  ${text}\n${log.textContent ?? ""}`.slice(0, 2000);
}

export function setupLaunchPanel(send: Send): void {
  element("l-fire").addEventListener("click", fireWith(machineMessage, send));
  element("t-fire").addEventListener("click", fireWith(targetMessage, send));
  element("l-stop").addEventListener("click", () => send({ kind: "stop" }));
  element("l-pause").addEventListener("click", () => send({ kind: "pause" }));
}
