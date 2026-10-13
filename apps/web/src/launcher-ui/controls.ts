import { directionLabel } from "./aim.js";
import type { Assumptions } from "./assumptions.js";
import { h, slider, spinControl } from "./dom.js";
import { SPANS } from "./ranges.js";
import type { FireMessage, LauncherVariant } from "./variant.js";

/** A: every ball-machine parameter as a labelled slider with steppers. */
export function controlsVariant(): LauncherVariant {
  const shot = { direction: 0, speed: 5, spin: 0, elevation: 20, count: 1, interval: 4 };

  function mount(el: HTMLElement, onChange: () => void, assumptions: Assumptions): void {
    const setter = (key: keyof typeof shot) => (value: number) => {
      shot[key] = value;
      if (key === "count") interval.el.classList.toggle("muted", value === 1);
      onChange();
    };
    const interval = slider({
      id: "l-interval",
      label: "Interval",
      span: SPANS.interval,
      value: shot.interval,
      format: (v) => `${v.toFixed(1)} s`,
      onInput: setter("interval"),
    });
    interval.el.classList.toggle("muted", shot.count === 1);
    el.replaceChildren(
      h(
        "div",
        { class: "controls-grid" },
        slider({
          id: "l-dir",
          label: "Direction",
          span: SPANS.direction,
          value: shot.direction,
          reversed: assumptions.flipDirection,
          format: (v) => directionLabel(v, assumptions.flipDirection),
          onInput: setter("direction"),
        }).el,
        slider({
          id: "l-elev",
          label: "Elevation",
          span: SPANS.elevation,
          value: shot.elevation,
          format: (v) => `${v}°`,
          onInput: setter("elevation"),
        }).el,
        slider({
          id: "l-speed",
          label: "Speed",
          span: SPANS.speed,
          value: shot.speed,
          format: (v) => `${v} / 10`,
          onInput: setter("speed"),
        }).el,
        spinControl(shot.spin, setter("spin")),
        slider({ id: "l-count", label: "Balls", span: SPANS.count, value: shot.count, onInput: setter("count") }).el,
        interval.el,
      ),
    );
  }

  return {
    id: "a",
    name: "Controls",
    mount,
    current: (): FireMessage => ({ kind: "machine", ...shot }),
  };
}
