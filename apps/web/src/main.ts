import "./style.css";
import "./launcher-ui/launcher.css";
import { STOP_KEY, applyStopLatch, gamepadToInput, isDriveKey, keysToInput, pressKey, releaseKey } from "../../../tools/web-drive/src/input.js";
import type { LaunchMessage } from "../../../tools/web-drive/src/launcher.js";
import { NEUTRAL, combineInputs, resolveMotion, type DriveInput, type Motion } from "../../../tools/web-drive/src/motion.js";
import { showLaunchStatus } from "../../../tools/web-drive/src/page/launch-panel.js";
import { showPower } from "../../../tools/web-drive/src/page/power.js";
import { bluetoothOf, requestBleLink } from "./ble-link.js";
import type { Link } from "./link.js";
import { isLauncherControl, setupLauncher } from "./launcher-ui/shell.js";
import { MockLink } from "./mock-link.js";
import { RobotSession, type SessionEvents } from "./session.js";
import { renderSticks, setupThumbsticks } from "./ui/thumbsticks.js";

const INPUT_MS = 50;
const TICK_MS = 10;
const GAMEPAD_STOP_BUTTON = 1; // B on Xbox layouts, circle on PlayStation.

const view = (id: string) => document.getElementById(id) as HTMLElement;
const connectButton = view("connect") as HTMLButtonElement;
const mock = new URLSearchParams(location.search).get("mock") === "1";
const bluetooth = bluetoothOf(navigator);

let active: { link: Link; session: RobotSession; tick: ReturnType<typeof setInterval> } | null = null;
let held = new Set<string>();
let latched = false;
const sticks = setupThumbsticks(update);
const launcher = setupLauncher(sendLaunch);

const events: SessionEvents = {
  onCarState: showPower,
  onMessage: (message) => {
    if (message.type === "rsp_init_data") showLaunchStatus(`rsp_init_data ${JSON.stringify(message.data ?? {})}`);
  },
  onSent: (motion) => (view("sent").textContent = motion),
  report: showLaunchStatus,
};

function clock() {
  return {
    now: Date.now,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    countryCode: new Intl.Locale(navigator.language).maximize().region ?? "US",
  };
}

// Only ever called from the Connect click: requestDevice needs the user gesture, and nothing is sent before it.
async function connect(): Promise<void> {
  connectButton.disabled = true;
  view("robot").textContent = "choose the robot…";
  try {
    const link = mock ? new MockLink() : await requestBleLink(bluetooth!);
    const session = new RobotSession(link, events, clock());
    link.onDisconnect(() => onDisconnected(link));
    active = { link, session, tick: setInterval(() => session.tick(), TICK_MS) };
    await session.start();
    view("robot").textContent = link.name;
    connectButton.textContent = "Disconnect";
  } catch (error) {
    view("robot").textContent = `not connected: ${(error as Error).message}`;
  } finally {
    connectButton.disabled = false;
  }
}

// Never reconnects by itself: a robot that drops out stays stopped until someone taps Connect again.
function onDisconnected(link: Link): void {
  if (active?.link !== link) return;
  clearInterval(active.tick);
  active = null;
  dropInputs();
  view("robot").textContent = `${link.name} disconnected; tap Connect to reconnect`;
  view("sent").textContent = "nothing";
  connectButton.textContent = "Connect";
}

function readGamepad(): { input: DriveInput; stop: boolean; label: string } {
  const pad = navigator.getGamepads?.().find((p) => p !== null);
  if (!pad) return { input: NEUTRAL, stop: false, label: "none (press a button to wake it)" };
  return { input: gamepadToInput(pad.axes), stop: pad.buttons[GAMEPAD_STOP_BUTTON]?.pressed ?? false, label: pad.id };
}

function emergencyStop(): void {
  // A held gamepad button calls this every frame; send run_stop once per press.
  if (!latched) void active?.session.emergencyStop();
  launcher.cancelHold();
  held = new Set();
  sticks.releaseAll();
  renderSticks(sticks);
  latched = true;
}

function update(): void {
  const pad = readGamepad();
  if (pad.stop) emergencyStop();
  // Dragging or typing in the launcher never drives, whatever the keys, sticks or gamepad say.
  const aiming = launcher.ownsInput();
  const input = aiming ? NEUTRAL : combineInputs(keysToInput(held), pad.input, sticks.input());
  const focused = !document.hidden && document.hasFocus();
  const result = applyStopLatch(latched, focused ? resolveMotion(input) : "stop");
  latched = result.latched;
  active?.session.drive(result.motion);
  launcher.setState({ connected: active !== null, running: active?.session.launcher.running ?? false });
  render(result.motion, input, aiming ? "ignored while the launcher has the controls" : pad.label);
}

function render(motion: Motion, input: DriveInput, padLabel: string): void {
  view("motion").textContent = latched ? "STOP (release all to rearm)" : motion;
  view("motion").className = motion === "stop" ? "stopped" : "moving";
  view("estop").classList.toggle("latched", latched);
  view("input").textContent = `x ${input.x.toFixed(2)}  y ${input.y.toFixed(2)}  turn ${input.turn.toFixed(2)}`;
  view("pad").textContent = padLabel;
}

function onKey(event: KeyboardEvent, down: boolean): void {
  // Typing or aiming in the launcher must never drive the robot. Space still stops from anywhere except the preset
  // JSON box, where it has to type; the STOP button and gamepad B still work there.
  if (isLauncherControl(event.target) && (event.code !== STOP_KEY || event.target instanceof HTMLTextAreaElement)) return;
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

// Key-ups and pointer-ups are never seen once the page loses focus, so forget every held input and stop now.
function dropInputs(): void {
  held = new Set();
  sticks.releaseAll();
  renderSticks(sticks);
  active?.session.release();
  update();
}

function sendLaunch(message: LaunchMessage): void {
  if (!active) return showLaunchStatus("Connect first.");
  void active.session.launch(message);
}

function start(): void {
  if (mock) view("robot").textContent = "mock mode: Connect uses a pretend robot";
  else if (!bluetooth) {
    view("unsupported").hidden = false;
    connectButton.disabled = true;
  }
  connectButton.addEventListener("click", () => (active ? void active.session.shutdown() : void connect()));
  view("estop").addEventListener("pointerdown", emergencyStop);
  window.addEventListener("keydown", (event) => onKey(event, true));
  window.addEventListener("keyup", (event) => onKey(event, false));
  window.addEventListener("blur", dropInputs);
  document.addEventListener("visibilitychange", dropInputs);
  window.addEventListener("pagehide", () => {
    dropInputs();
    void active?.session.shutdown();
  });
  setInterval(update, INPUT_MS);
  update();
}

start();
