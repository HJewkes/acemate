import {
  aimToPad,
  directionLabel,
  pixelToAim,
  type Aim,
  flipped,
  type Assumptions,
  SPANS,
  stepBy,
  type FireMessage,
} from "@acemate/core";
import { h, s, slider, spinControl } from "./dom.js";
import { type LauncherVariant } from "./variant.js";

const TICK_EVERY = 5;
const PAD = 100; // The pad's SVG is 100 × 100 user units, stretched to the square.

function ticks(span: { min: number; max: number }): number[] {
  const out: number[] = [];
  for (let value = Math.ceil(span.min / TICK_EVERY) * TICK_EVERY; value <= span.max; value += TICK_EVERY)
    out.push(value);
  return out;
}

function padGrid(flipDirection: boolean): SVGElement {
  const lines: SVGElement[] = [];
  for (const direction of ticks(SPANS.direction)) {
    const { fx } = aimToPad({ direction, elevation: SPANS.elevation.min }, flipDirection);
    lines.push(s("line", { x1: fx * PAD, y1: 0, x2: fx * PAD, y2: PAD, class: direction === 0 ? "axis" : "grid" }));
  }
  for (const elevation of ticks(SPANS.elevation)) {
    const { fy } = aimToPad({ direction: 0, elevation }, flipDirection);
    lines.push(s("line", { x1: 0, y1: fy * PAD, x2: PAD, y2: fy * PAD, class: "grid" }));
  }
  return s("svg", { viewBox: `0 0 ${PAD} ${PAD}`, preserveAspectRatio: "none", class: "pad-grid" }, ...lines);
}

function axisLabels(): HTMLElement {
  return h(
    "div",
    { class: "pad-labels" },
    h("span", { class: "pad-top" }, `${SPANS.elevation.max}°`),
    h("span", { class: "pad-bottom" }, `${SPANS.elevation.min}°`),
    h("span", { class: "pad-left" }, "◀ L 15°"),
    h("span", { class: "pad-right" }, "R 15° ▶"),
  );
}

/** Side view: the launch angle above the ground line. */
function sideView(aim: Aim): SVGElement {
  const rad = (aim.elevation * Math.PI) / 180;
  const [x0, y0, len] = [12, 52, 60];
  return s(
    "svg",
    { viewBox: "0 0 100 60", class: "sketch", "aria-label": "Side view of the launch angle" },
    s("line", { x1: 4, y1: y0, x2: 96, y2: y0, class: "ground" }),
    s("path", {
      d: `M ${x0 + 22} ${y0} A 22 22 0 0 0 ${x0 + 22 * Math.cos(rad)} ${y0 - 22 * Math.sin(rad)}`,
      class: "angle",
    }),
    s("line", { x1: x0, y1: y0, x2: x0 + len * Math.cos(rad), y2: y0 - len * Math.sin(rad), class: "ray" }),
    s("rect", { x: x0 - 6, y: y0 - 6, width: 10, height: 6, rx: 1.5, class: "robot" }),
  );
}

/** Top view: the ±15° fan and where this shot points inside it. */
function topView(aim: Aim, flipDirection: boolean): SVGElement {
  const at = (degrees: number, r: number) => {
    const rad = (degrees * Math.PI) / 180;
    return { x: 50 + r * Math.sin(rad), y: 56 - r * Math.cos(rad) };
  };
  const [left, right] = [at(SPANS.direction.min, 52), at(SPANS.direction.max, 52)];
  const tip = at(flipped(aim.direction, flipDirection), 50);
  return s(
    "svg",
    { viewBox: "0 0 100 60", class: "sketch", "aria-label": "Top view of the direction" },
    s("path", { d: `M 50 56 L ${left.x} ${left.y} A 52 52 0 0 1 ${right.x} ${right.y} Z`, class: "fan" }),
    s("line", { x1: 50, y1: 56, x2: 50, y2: 6, class: "axis" }),
    s("line", { x1: 50, y1: 56, x2: tip.x, y2: tip.y, class: "ray" }),
    s("rect", { x: 45, y: 53, width: 10, height: 6, rx: 1.5, class: "robot" }),
  );
}

/** C: a 2-D pad for direction × elevation, a big speed fader, and the rest underneath. */
export function aimPadVariant(): LauncherVariant {
  const shot = { direction: 0, elevation: 20, speed: 5, spin: 0, count: 1, interval: 4 };

  function mount(el: HTMLElement, onChange: () => void, assumptions: Assumptions): void {
    const flip = assumptions.flipDirection;
    const cross = h("div", { class: "crosshair" }, h("div", { class: "dot" }));
    const pad = h(
      "div",
      {
        class: "pad",
        tabindex: 0,
        "data-grab": "",
        role: "application",
        "aria-label": "Aim pad: direction across, elevation up",
      },
      padGrid(flip),
      axisLabels(),
      cross,
    );
    const readout = h("div", { class: "aim-readout" });
    const sketches = h("div", { class: "sketches" });
    const render = () => {
      const { fx, fy } = aimToPad(shot, flip);
      cross.style.setProperty("--fx", `${fx * 100}%`);
      cross.style.setProperty("--fy", `${fy * 100}%`);
      readout.textContent = `${directionLabel(shot.direction, flip)} · ${shot.elevation}°`;
      sketches.replaceChildren(sideView(shot), topView(shot, flip));
      onChange();
    };
    attachPad(pad, flip, render);
    const set = (key: "speed" | "spin" | "count" | "interval") => (value: number) => {
      shot[key] = value;
      render();
    };
    el.replaceChildren(
      h(
        "div",
        { class: "aim-layout" },
        h("div", { class: "pad-wrap" }, pad, readout),
        slider({
          id: "l-speed",
          label: "Speed",
          span: SPANS.speed,
          value: shot.speed,
          vertical: true,
          onInput: set("speed"),
        }).el,
        h(
          "div",
          { class: "aim-side" },
          sketches,
          spinControl(shot.spin, set("spin"), false),
          h(
            "div",
            { class: "row" },
            slider({ id: "l-count", label: "Balls", span: SPANS.count, value: shot.count, onInput: set("count") }).el,
            slider({
              id: "l-interval",
              label: "Every",
              span: SPANS.interval,
              value: shot.interval,
              format: (v) => `${v.toFixed(1)} s`,
              onInput: set("interval"),
            }).el,
          ),
        ),
      ),
    );
    render();
  }

  function attachPad(pad: HTMLElement, flip: boolean, render: () => void): void {
    let dragging = false;
    const aimAt = (event: PointerEvent) => {
      const box = pad.getBoundingClientRect();
      Object.assign(shot, pixelToAim(event.clientX - box.left, event.clientY - box.top, box, flip));
      render();
    };
    pad.addEventListener("pointerdown", (event) => {
      dragging = true;
      pad.setPointerCapture?.(event.pointerId);
      aimAt(event);
    });
    pad.addEventListener("pointermove", (event) => dragging && aimAt(event));
    pad.addEventListener("pointerup", () => (dragging = false));
    pad.addEventListener("pointercancel", () => (dragging = false));
    pad.addEventListener("keydown", (event) => {
      const nudge = padNudge(event.code, flip);
      if (!nudge) return;
      event.preventDefault();
      shot.direction = stepBy(shot.direction, nudge.direction, SPANS.direction);
      shot.elevation = stepBy(shot.elevation, nudge.elevation, SPANS.elevation);
      render();
    });
  }

  return { id: "c", name: "Aim pad", mount, current: (): FireMessage => ({ kind: "machine", ...shot }) };
}

/** Arrow keys on the focused pad move the crosshair the way they point on screen. */
function padNudge(code: string, flip: boolean): { direction: number; elevation: number } | null {
  const right = flip ? -1 : 1;
  const moves: Record<string, { direction: number; elevation: number }> = {
    ArrowLeft: { direction: -right, elevation: 0 },
    ArrowRight: { direction: right, elevation: 0 },
    ArrowUp: { direction: 0, elevation: 1 },
    ArrowDown: { direction: 0, elevation: -1 },
  };
  return moves[code] ?? null;
}
