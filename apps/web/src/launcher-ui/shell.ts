import { showLaunchStatus } from "../../../../tools/web-drive/src/page/launch-panel.js";
import type { LaunchMessage } from "../../../../tools/web-drive/src/launcher.js";
import { aimPadVariant } from "./aim-pad.js";
import { ASSUMPTION_NOTES, loadAssumptions, saveAssumptions, type Assumptions } from "./assumptions.js";
import { controlsVariant } from "./controls.js";
import { courtMapVariant } from "./court-map.js";
import { h, segmented } from "./dom.js";
import { createHoldFire, type HoldReading } from "./hold-fire.js";
import { presetBoardVariant } from "./preset-board.js";
import {
  VARIANT_IDS,
  describeShot,
  initialVariant,
  type FireMessage,
  type LauncherVariant,
  type VariantId,
} from "./variant.js";

const VARIANT_KEY = "acemate.launcher.variant";
const CONTROL_SELECTOR = "input, textarea, select, [data-grab]";

/** True for anything that takes typing, arrows or drags; keys aimed at one must never drive. */
export function isLauncherControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(CONTROL_SELECTOR) !== null;
}

export interface Launcher {
  /** Fire is only enabled while connected, with no run active, and with a shot to send. */
  setState(state: FireState): void;
  /** Drops any Fire hold in progress without sending. */
  cancelHold(): void;
  /** True while a launcher control has focus or a pointer is down anywhere in the launcher. */
  ownsInput(): boolean;
}

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export type FireState = { connected: boolean; running: boolean; inFlight: boolean };

/** Why Fire is locked, or "" when it may be held. */
export function fireLock(status: FireState): string {
  if (!status.connected) return "Connect first";
  if (status.running) return "A run is active";
  return status.inFlight ? "Waiting for the robot" : "";
}

type FireBar = Omit<Launcher, "ownsInput"> & { refresh(): void };

/** Fire (press and hold), Pause and Stop. */
function fireBar(
  shot: () => FireMessage | null,
  describe: (shot: FireMessage | null) => string,
  send: (message: LaunchMessage) => void,
  fired: () => void,
): FireBar {
  const fire = element<HTMLButtonElement>("l-fire");
  const hold = createHoldFire();
  let status: FireState = { connected: false, running: false, inFlight: false };
  let timer: ReturnType<typeof setInterval> | undefined;
  const show = (progress: number) => fire.style.setProperty("--hold", String(progress));
  const settle = (reading: HoldReading) => {
    show(reading.progress);
    if (reading.progress === 0 || reading.progress === 1) clearInterval(timer);
    if (!reading.fire) return;
    const next = shot();
    if (!next) return showLaunchStatus("Nothing to fire.");
    send(next);
    fired();
  };
  const cancel = () => settle(hold.cancel());
  const release = () => settle(hold.release());
  const press = () => {
    if (fire.disabled) return;
    settle(hold.press(performance.now()));
    clearInterval(timer);
    timer = setInterval(() => settle(hold.tick(performance.now())), 30);
  };
  const refresh = () => {
    const next = shot();
    element("l-summary").textContent = describe(next);
    fire.title = fireLock(status);
    fire.disabled = fire.title !== "" || next === null;
    if (fire.disabled) cancel();
  };
  fire.addEventListener("pointerdown", (event) => event.button === 0 && press());
  for (const type of ["pointerup", "pointerleave"]) fire.addEventListener(type, release);
  fire.addEventListener("pointercancel", cancel);
  fire.addEventListener("contextmenu", (event) => event.preventDefault());
  fire.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) press();
  });
  fire.addEventListener("keyup", (event) => event.key === "Enter" && release());
  fire.addEventListener("blur", cancel);
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", cancel);
  element("l-stop").addEventListener("click", () => send({ kind: "stop" }));
  element("l-pause").addEventListener("click", () => send({ kind: "pause" }));
  return {
    refresh,
    setState(next) {
      if (next.connected === status.connected && next.running === status.running && next.inFlight === status.inFlight)
        return;
      status = next;
      refresh();
    },
    cancelHold: cancel,
  };
}

/** Counts pointers that went down inside root and have not lifted yet, wherever they lift. */
function pointersDownIn(root: HTMLElement): () => boolean {
  const pointers = new Set<number>();
  root.addEventListener("pointerdown", (event) => pointers.add(event.pointerId), { capture: true });
  const lift = (event: PointerEvent) => pointers.delete(event.pointerId);
  window.addEventListener("pointerup", lift, { capture: true });
  window.addEventListener("pointercancel", lift, { capture: true });
  window.addEventListener("blur", () => pointers.clear());
  return () => pointers.size > 0;
}

function rememberChoice(id: VariantId): void {
  globalThis.localStorage?.setItem(VARIANT_KEY, id);
  const url = new URL(location.href);
  url.searchParams.set("launcher", id);
  history.replaceState(history.state, "", url);
}

export function setupLauncher(send: (message: LaunchMessage) => void): Launcher {
  const root = element("launcher");
  const host = element("launcher-variant");
  const variants = new Map<VariantId, LauncherVariant>(
    [controlsVariant(), courtMapVariant(), aimPadVariant(), presetBoardVariant()].map((variant) => [
      variant.id,
      variant,
    ]),
  );
  let assumptions = loadAssumptions(globalThis.localStorage);
  let chosen = initialVariant(
    new URLSearchParams(location.search).get("launcher"),
    globalThis.localStorage?.getItem(VARIANT_KEY) ?? null,
  );
  const variant = () => variants.get(chosen)!;
  const mountVariant = () => {
    host.dataset.variant = chosen;
    variant().mount(host, bar.refresh, assumptions);
    bar.refresh();
  };
  const bar = fireBar(
    () => variant().current(),
    (shot) => describeShot(shot, assumptions.flipDirection),
    send,
    () => {
      variant().fired?.();
      mountVariant();
    },
  );

  const names = VARIANT_IDS.map((id) => ({ value: id, label: `${id.toUpperCase()} · ${variants.get(id)!.name}` }));
  element("launcher-switch").replaceChildren(
    segmented("Launcher layout", names, chosen, (id) => {
      chosen = id;
      rememberChoice(id);
      mountVariant();
    }).el,
  );
  element("launcher-assumptions").replaceChildren(
    assumptionsPanel(
      () => assumptions,
      (next) => {
        assumptions = next;
        saveAssumptions(globalThis.localStorage, next);
        mountVariant();
      },
    ),
  );
  globalThis.matchMedia?.("(min-aspect-ratio: 5/4)").addEventListener?.("change", mountVariant);
  watchVisibility(root);
  const pointerDown = pointersDownIn(root);
  mountVariant();
  return {
    setState: bar.setState,
    cancelHold: bar.cancelHold,
    ownsInput: () =>
      pointerDown() || (root.contains(document.activeElement) && isLauncherControl(document.activeElement)),
  };
}

// Lets the CSS move STOP out of the aiming area while the launcher fills the screen.
function watchVisibility(root: HTMLElement): void {
  if (typeof IntersectionObserver === "undefined") return;
  const observer = new IntersectionObserver(
    ([entry]) => document.body.classList.toggle("launcher-in-view", entry?.isIntersecting ?? false),
    {
      rootMargin: "0px 0px -50% 0px", // in view once it reaches the top half of the screen
    },
  );
  observer.observe(root);
}

function assumptionsPanel(get: () => Assumptions, set: (next: Assumptions) => void): HTMLElement {
  const toggle = (key: "flipDirection" | "flipX", text: string) => {
    const box = h("input", { type: "checkbox", checked: get()[key] });
    box.addEventListener("change", () => set({ ...get(), [key]: box.checked }));
    return h("label", { class: "check" }, box, text);
  };
  const robotZ = h("input", { type: "number", step: 0.5, min: -3, max: 6, value: get().robotZ, class: "num" });
  robotZ.addEventListener(
    "change",
    () => Number.isFinite(robotZ.valueAsNumber) && set({ ...get(), robotZ: robotZ.valueAsNumber }),
  );
  return h(
    "details",
    { class: "assumptions" },
    h("summary", {}, "Assumptions", h("span", { class: "wordy" }, " (unconfirmed on hardware)")),
    h(
      "div",
      { class: "row" },
      toggle("flipDirection", "Flip direction: +dir aims left"),
      toggle("flipX", "Flip court x: +x is the robot's left"),
      h("label", { class: "check" }, "Robot stands at z =", robotZ, "m"),
    ),
    h("ul", {}, ...ASSUMPTION_NOTES.map((note) => h("li", {}, note))),
  );
}
