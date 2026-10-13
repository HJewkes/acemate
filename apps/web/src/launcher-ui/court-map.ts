import { HEIGHT_METRES_BY_LEVEL, flipped, type Assumptions, SPANS, type FireMessage } from "@acemate/core";
import { COURT, courtToSvg, courtViewBox, pixelToTarget, type CourtPoint, type Orientation } from "./court.js";
import { h, s, segmented, slider, spinControl } from "./dom.js";
import { type LauncherVariant } from "./variant.js";

export const MAX_SEQUENCE = 5;

type Mode = "single" | "sequence";
interface View {
  orientation: Orientation;
  flipX: boolean;
  robotZ: number;
}

// Landscape screens get the court on its side, so a phone held sideways still gets a big tap area.
function orientationNow(): Orientation {
  return globalThis.matchMedia?.("(min-aspect-ratio: 5/4)").matches ? "horizontal" : "vertical";
}

function courtLines(view: View): SVGElement {
  const at = (x: number, z: number) => courtToSvg({ x, z }, view.orientation, view.flipX);
  const line = (x1: number, z1: number, x2: number, z2: number, cls = "chalk") => {
    const [a, b] = [at(x1, z1), at(x2, z2)];
    return s("line", { x1: a.u, y1: a.v, x2: b.u, y2: b.v, class: cls });
  };
  const rect = (x1: number, z1: number, x2: number, z2: number, cls: string) => {
    const [a, b] = [at(x1, z1), at(x2, z2)];
    return s("rect", {
      x: Math.min(a.u, b.u),
      y: Math.min(a.v, b.v),
      width: Math.abs(a.u - b.u),
      height: Math.abs(a.v - b.v),
      class: cls,
    });
  };
  const { singlesHalf: w, doublesHalf: d, length: L, net, serviceFromNet: sv } = COURT;
  const zone = SPANS.targetZ;
  return s(
    "g",
    {},
    rect(-d, 0, d, L, "surface"),
    rect(-w, zone.min, w, zone.max, "reach"),
    rect(-d, 0, d, L, "chalk"),
    line(-w, 0, -w, L),
    line(w, 0, w, L),
    line(-w, net - sv, w, net - sv),
    line(-w, net + sv, w, net + sv),
    line(0, net - sv, 0, net + sv),
    line(0, 0, 0, 0.3),
    line(0, L, 0, L - 0.3),
    line(-d - 0.3, net, d + 0.3, net, "net"),
  );
}

function robotMark(view: View): SVGElement {
  const p = courtToSvg({ x: 0, z: view.robotZ }, view.orientation, view.flipX);
  const side = courtToSvg({ x: 0.8, z: view.robotZ - 0.9 }, view.orientation, view.flipX);
  const label = s("text", { x: side.u, y: side.v, class: "robot-label" });
  label.textContent = "robot";
  return s(
    "g",
    {},
    s("rect", { x: p.u - 0.45, y: p.v - 0.45, width: 0.9, height: 0.9, rx: 0.15, class: "robot" }),
    label,
  );
}

function shotMark(view: View, target: CourtPoint, index: number, state: "next" | "queued" | "only"): SVGElement {
  const from = courtToSvg({ x: 0, z: view.robotZ }, view.orientation, view.flipX);
  const to = courtToSvg(target, view.orientation, view.flipX);
  const group = s(
    "g",
    { class: `shot ${state}` },
    s("line", { x1: from.u, y1: from.v, x2: to.u, y2: to.v, class: "flight" }),
    s("circle", { cx: to.u, cy: to.v, r: 0.75, class: "ring" }),
    s("circle", { cx: to.u, cy: to.v, r: 0.22, class: "ball" }),
  );
  if (state !== "only") {
    const number = s("text", { x: to.u, y: to.v - 0.95, class: "shot-number" });
    number.textContent = String(index + 1);
    group.append(number);
  }
  return group;
}

/** "x R 1.3 m · z 18.2 m (6.3 m past the net)". */
export function targetReadout(target: CourtPoint, flipX: boolean): string {
  const right = flipped(target.x, flipX);
  const side = right === 0 ? "centre" : `${right > 0 ? "R" : "L"} ${Math.abs(right).toFixed(1)} m`;
  const past = target.z - COURT.net;
  const net = past >= 0 ? `${past.toFixed(1)} m past the net` : `${(-past).toFixed(1)} m short of the net`;
  return `x ${side} · z ${target.z.toFixed(1)} m (${net})`;
}

/** B: tap or drag on a top-down singles court; the robot solves the aim (drill mode). */
export function courtMapVariant(): LauncherVariant {
  const state = {
    mode: "single" as Mode,
    targets: [{ x: 0, z: 19 }] as CourtPoint[],
    next: 0,
    heightLevel: 4,
    spin: 0,
  };

  function mount(el: HTMLElement, onChange: () => void, assumptions: Assumptions): void {
    const view = (): View => ({ orientation: orientationNow(), flipX: assumptions.flipX, robotZ: assumptions.robotZ });
    const svg = s("svg", {
      class: `court ${view().orientation}`,
      preserveAspectRatio: "xMidYMid meet",
      "data-grab": "",
      role: "application",
      "aria-label": "Court: tap to place the target",
    }) as SVGSVGElement;
    const readout = h("div", { class: "court-readout" });
    const sequenceBar = h("div", { class: "sequence-bar" });
    const changed = () => {
      draw(svg, readout, sequenceBar, view());
      onChange();
    };
    attachPointer(svg, view, changed);
    el.replaceChildren(
      h(
        "div",
        { class: "court-layout" },
        h("div", { class: "court-wrap" }, svg),
        h(
          "div",
          { class: "court-side" },
          segmented<Mode>(
            "Targets",
            [
              { value: "single", label: "One target" },
              { value: "sequence", label: `Sequence ≤${MAX_SEQUENCE}` },
            ],
            state.mode,
            (mode) => {
              state.mode = mode;
              // A sequence starts empty so taps number from 1; going back to one target keeps the last one placed.
              state.targets = mode === "single" ? state.targets.slice(-1) : [];
              state.next = 0;
              changed();
            },
          ).el,
          readout,
          sequenceBar,
          slider({
            id: "t-height",
            label: "Height",
            span: SPANS.heightLevel,
            value: state.heightLevel,
            format: (v) => `lvl ${v} · ${HEIGHT_METRES_BY_LEVEL[v - 1]} m apex`,
            onInput: (v) => {
              state.heightLevel = v;
              changed();
            },
          }).el,
          spinControl(
            state.spin,
            (v) => {
              state.spin = v;
              changed();
            },
            false,
          ),
        ),
      ),
    );
    draw(svg, readout, sequenceBar, view());
  }

  function attachPointer(svg: SVGSVGElement, view: () => View, changed: () => void): void {
    let dragging = -1;
    const place = (event: PointerEvent, start: boolean) => {
      const box = svg.getBoundingClientRect();
      const target = pixelToTarget(event.clientX - box.left, event.clientY - box.top, box, view());
      if (start) dragging = startDrag(target);
      if (dragging >= 0) state.targets[dragging] = target;
      changed();
    };
    svg.addEventListener("pointerdown", (event) => {
      svg.setPointerCapture?.(event.pointerId);
      place(event, true);
    });
    svg.addEventListener("pointermove", (event) => dragging >= 0 && place(event, false));
    const end = () => void (dragging = -1);
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }

  // Single: the one target follows the finger. Sequence: a tap adds the next target, up to the cap.
  function startDrag(target: CourtPoint): number {
    if (state.mode === "single") {
      state.targets = [target];
      return 0;
    }
    if (state.targets.length >= MAX_SEQUENCE) return -1;
    state.targets.push(target);
    return state.targets.length - 1;
  }

  function draw(svg: SVGSVGElement, readout: HTMLElement, bar: HTMLElement, view: View): void {
    const box = courtViewBox(view.orientation, view.robotZ);
    svg.setAttribute("viewBox", `${box.minU} ${box.minV} ${box.width} ${box.height}`);
    svg.setAttribute("class", `court ${view.orientation}`);
    const marks = state.targets.map((target, index) => {
      const kind = state.mode === "single" ? "only" : index === state.next ? "next" : "queued";
      return shotMark(view, target, index, kind);
    });
    svg.replaceChildren(courtLines(view), robotMark(view), ...marks);
    const shown = state.targets[state.next];
    readout.textContent = shown ? targetReadout(shown, view.flipX) : "Tap the court to add targets in order.";
    drawSequenceBar(bar, () => draw(svg, readout, bar, view));
  }

  function drawSequenceBar(bar: HTMLElement, redraw: () => void): void {
    bar.hidden = state.mode === "single";
    const clear = h("button", { type: "button" }, "Clear");
    clear.addEventListener("click", () => {
      state.targets = [];
      state.next = 0;
      redraw();
    });
    const undo = h("button", { type: "button", disabled: state.targets.length === 0 }, "Undo");
    undo.addEventListener("click", () => {
      state.targets.pop();
      state.next = Math.min(state.next, Math.max(0, state.targets.length - 1));
      redraw();
    });
    const count = state.targets.length;
    bar.replaceChildren(
      h("span", {}, count === 0 ? "no targets" : `next ${state.next + 1} of ${count}`),
      undo,
      clear,
      h(
        "p",
        { class: "hint" },
        "Each target is its own Fire hold: one drill set_mode carries one target, and chaining runs would fire without a fresh hold.",
      ),
    );
  }

  return {
    id: "b",
    name: "Court map",
    mount,
    current(): FireMessage | null {
      const target = state.targets[state.next];
      return target
        ? { kind: "target", x: target.x, z: target.z, heightLevel: state.heightLevel, spin: state.spin }
        : null;
    },
    fired() {
      if (state.mode === "sequence" && state.targets.length > 0) state.next = (state.next + 1) % state.targets.length;
    },
  };
}
