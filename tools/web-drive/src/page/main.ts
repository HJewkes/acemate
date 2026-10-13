import {
  STOP_KEY,
  applyStopLatch,
  gamepadToInput,
  isDriveKey,
  keysToInput,
  pressKey,
  releaseKey,
  type LaunchMessage,
  MOTION_RULE,
  NEUTRAL,
  combineInputs,
  resolveMotion,
  type DriveInput,
  type Motion,
} from "@acemate/core";
import { setupLaunchPanel, showLaunchStatus } from "./launch-panel.js";
import { showPower, type CarStateView } from "./power.js";

// The server stops the robot if this heartbeat goes quiet for 300 ms.
const SEND_MS = 50;
const GAMEPAD_STOP_BUTTON = 1; // B on Xbox layouts, circle on PlayStation.

const view = (id: string) => document.getElementById(id) as HTMLElement;
let held = new Set<string>();
let latched = false;
let socket: WebSocket | null = null;

function connectSocket(): void {
  const ws = new WebSocket(`ws://${location.host}/control`);
  ws.onopen = () => (view("link").textContent = "connected");
  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as {
      sent?: string;
      launch_status?: string;
      car_state?: CarStateView;
    };
    if (message.sent) view("sent").textContent = message.sent;
    if (message.launch_status) showLaunchStatus(message.launch_status);
    if (message.car_state) showPower(message.car_state);
  };
  ws.onclose = (event) => {
    view("link").textContent = `disconnected${event.reason ? `: ${event.reason}` : ""}; retrying`;
    socket = null;
    setTimeout(connectSocket, 1000);
  };
  socket = ws;
}

function readGamepad(): { input: DriveInput; stop: boolean; label: string } {
  const pad = navigator.getGamepads().find((p) => p !== null);
  if (!pad) return { input: NEUTRAL, stop: false, label: "none (press a button to wake it)" };
  return { input: gamepadToInput(pad.axes), stop: pad.buttons[GAMEPAD_STOP_BUTTON]?.pressed ?? false, label: pad.id };
}

function emergencyStop(): void {
  // A held gamepad button calls this every frame; send run_stop once per press.
  if (!latched) sendLaunch({ kind: "stop" });
  held = new Set();
  latched = true;
}

function sendLaunch(message: LaunchMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ launch: message }));
}

function update(): void {
  const pad = readGamepad();
  if (pad.stop) emergencyStop();
  const input = combineInputs(keysToInput(held), pad.input);
  const active = !document.hidden && document.hasFocus();
  const result = applyStopLatch(latched, active ? resolveMotion(input) : "stop");
  latched = result.latched;
  render(result.motion, input, pad.label);
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ motion: result.motion }));
}

function render(motion: Motion, input: DriveInput, padLabel: string): void {
  view("motion").textContent = latched ? "STOP (release all to rearm)" : motion;
  view("motion").className = motion === "stop" ? "stopped" : "moving";
  view("input").textContent = `x ${input.x.toFixed(2)}  y ${input.y.toFixed(2)}  turn ${input.turn.toFixed(2)}`;
  view("pad").textContent = padLabel;
}

function onKey(event: KeyboardEvent, down: boolean): void {
  // Typing launch parameters must never drive the robot.
  if (event.target instanceof HTMLInputElement && event.code !== STOP_KEY) return;
  if (event.code === STOP_KEY) {
    if (down) emergencyStop();
  } else if (event.repeat) {
    // Auto-repeat would re-add a key that Space just dropped; a stopped key needs a fresh press.
    if (isDriveKey(event.code)) event.preventDefault();
    return;
  } else if (isDriveKey(event.code)) {
    held = down ? pressKey(held, event.code) : releaseKey(held, event.code);
  } else {
    return;
  }
  event.preventDefault();
  update();
}

// Key-ups are never seen once focus leaves, so forget every held key.
function dropKeys(): void {
  held = new Set();
  update();
}

view("rule").textContent =
  `${MOTION_RULE.priority} priority · rotate threshold ${MOTION_RULE.rotateThreshold} · deadzone ${MOTION_RULE.deadzone}`;
window.addEventListener("keydown", (event) => onKey(event, true));
window.addEventListener("keyup", (event) => onKey(event, false));
window.addEventListener("blur", dropKeys);
document.addEventListener("visibilitychange", dropKeys);
setupLaunchPanel(sendLaunch);
connectSocket();
setInterval(update, SEND_MS);

// Dev hot reload: the server pushes "reload" after rebuilding this page.
new EventSource("/events").onmessage = () => location.reload();
