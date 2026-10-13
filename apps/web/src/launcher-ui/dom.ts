import { SPANS, snapTo, stepBy, type Span, SPIN_STYLES, spinStyle, spinValue, type SpinStyle } from "@acemate/core";

type Attrs = Record<string, string | number | boolean | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string)[]) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (name === "class") el.className = String(value);
    else el.setAttribute(name, value === true ? "" : String(value));
  }
  el.append(...children);
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function s(tag: string, attrs: Attrs = {}, ...children: Node[]): SVGElement {
  const el = document.createElementNS(SVG_NS, tag) as SVGElement;
  for (const [name, value] of Object.entries(attrs)) if (value !== undefined) el.setAttribute(name, String(value));
  el.append(...children);
  return el;
}

export interface SliderOptions {
  id?: string;
  label: string;
  span: Span;
  value: number;
  /** The live readout; defaults to the plain number. */
  format?: (value: number) => string;
  /** Renders the track right-to-left, so dragging right lowers the value. */
  reversed?: boolean;
  vertical?: boolean;
  onInput(value: number): void;
}

export interface Slider {
  el: HTMLElement;
  set(value: number): void;
}

/** A labelled range with a live readout and − / + steppers, sized for thumbs. */
export function slider(options: SliderOptions): Slider {
  const format = options.format ?? String;
  const { min, max, step } = options.span;
  const input = h("input", {
    id: options.id,
    type: "range",
    min,
    max,
    step,
    value: options.value,
    "aria-label": options.label,
  });
  if (options.reversed) input.setAttribute("dir", "rtl");
  const readout = h("output", { class: "readout" }, format(options.value));
  const set = (value: number) => {
    const next = snapTo(value, options.span);
    input.value = String(next);
    readout.textContent = format(next);
    return next;
  };
  input.addEventListener("input", () => options.onInput(set(Number(input.value))));
  const stepper = (sign: number, text: string) => {
    const button = h("button", { type: "button", class: "step", "aria-label": `${options.label} ${text}` }, text);
    button.addEventListener("click", () => options.onInput(set(stepBy(Number(input.value), sign, options.span))));
    return button;
  };
  const orientation = options.vertical ? "slider vertical" : "slider";
  const el = h(
    "div",
    { class: orientation },
    h("span", { class: "slider-label" }, options.label),
    readout,
    stepper(options.vertical ? 1 : -1, options.vertical ? "+" : "−"),
    input,
    stepper(options.vertical ? -1 : 1, options.vertical ? "−" : "+"),
  );
  return { el, set: (value) => void set(value) };
}

export function segmented<T extends string>(
  label: string,
  options: { value: T; label: string }[],
  selected: T,
  onSelect: (value: T) => void,
): { el: HTMLElement; set(value: T): void } {
  const buttons = options.map((option) => {
    const button = h("button", { type: "button", role: "radio", "data-value": option.value }, option.label);
    button.addEventListener("click", () => {
      set(option.value);
      onSelect(option.value);
    });
    return button;
  });
  const set = (value: T) => {
    for (const button of buttons) button.setAttribute("aria-checked", String(button.dataset.value === value));
  };
  set(selected);
  return { el: h("div", { class: "segmented", role: "radiogroup", "aria-label": label }, ...buttons), set };
}

/** Slice / flat / topspin buttons plus a fine-tune slider over −3..3, kept in step with each other. */
export function spinControl(value: number, onInput: (spin: number) => void, withFineTune = true): HTMLElement {
  const styles = SPIN_STYLES.map(({ style, label }) => ({ value: style, label }));
  const fine = slider({
    label: "fine",
    span: SPANS.spin,
    value,
    format: (v) => (v > 0 ? `+${v}` : String(v)),
    onInput: (v) => {
      buttons.set(spinStyle(v));
      onInput(v);
    },
  });
  const buttons = segmented<SpinStyle>("Spin", styles, spinStyle(value), (style) => {
    fine.set(spinValue(style));
    onInput(spinValue(style));
  });
  return h(
    "div",
    { class: "spin" },
    h("span", { class: "slider-label" }, "Spin"),
    buttons.el,
    ...(withFineTune ? [fine.el] : []),
  );
}
