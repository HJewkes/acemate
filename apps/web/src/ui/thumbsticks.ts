import { StickPair, type Side } from "../sticks.js";

const SIDES: Side[] = ["left", "right"];
// The knob is 38% of the pad (style.css); its centre can travel to the rim minus half a knob.
const TRAVEL = (1 - 0.38) / 2;

const padOf = (side: Side) => document.getElementById(`stick-${side}`) as HTMLElement;

function offset(pad: HTMLElement, event: PointerEvent): { dx: number; dy: number } {
  const rect = pad.getBoundingClientRect();
  return { dx: event.clientX - (rect.left + rect.width / 2), dy: event.clientY - (rect.top + rect.height / 2) };
}

/** Binds the two DOM pads to a StickPair with Pointer Events; each pad captures its own finger. */
export function setupThumbsticks(onChange: () => void): StickPair {
  const pair = new StickPair(() => padOf("left").getBoundingClientRect().width * TRAVEL);
  const render = (side: Side) => renderStick(padOf(side), pair, side);
  for (const side of SIDES) {
    const pad = padOf(side);
    pad.addEventListener("pointerdown", (event) => {
      const { dx, dy } = offset(pad, event);
      if (!pair.down(side, event.pointerId, dx, dy)) return;
      pad.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      render(side);
      onChange();
    });
    pad.addEventListener("pointermove", (event) => {
      const { dx, dy } = offset(pad, event);
      if (pair.move(event.pointerId, dx, dy) !== side) return;
      render(side);
      onChange();
    });
    const lift = (event: PointerEvent) => {
      if (pair.up(event.pointerId) !== side) return;
      render(side);
      onChange();
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) pad.addEventListener(type, lift);
  }
  return pair;
}

export function renderSticks(pair: StickPair): void {
  for (const side of SIDES) renderStick(padOf(side), pair, side);
}

function renderStick(pad: HTMLElement, pair: StickPair, side: Side): void {
  const stick = pair.stick(side);
  const travel = pad.getBoundingClientRect().width * TRAVEL;
  const knob = pad.querySelector<HTMLElement>(".knob");
  if (knob) knob.style.transform = `translate(calc(-50% + ${stick.x * travel}px), calc(-50% + ${stick.y * travel}px))`;
  pad.classList.toggle("held", stick.x !== 0 || stick.y !== 0);
}
