import { directionLabel, type Assumptions, SPANS, spinLabel, type FireMessage } from "@acemate/core";
import { h, segmented, slider } from "./dom.js";
import {
  DEFAULT_PRESETS,
  MAX_QUEUE,
  parsePresets,
  presetMessage,
  queueMessage,
  queueRefusal,
  type Preset,
} from "./presets.js";
import { type LauncherVariant } from "./variant.js";

const STORAGE_KEY = "acemate.launcher.presets";
type Mode = "single" | "queue";

function presetDetail(preset: Preset, flipDirection: boolean): string {
  if (preset.kind === "target")
    return `target x ${preset.x} z ${preset.z} · h${preset.heightLevel} · ${spinLabel(preset.spin)}`;
  return `${directionLabel(preset.direction, flipDirection)} · ${preset.elevation}° · spd ${preset.speed} · ${spinLabel(preset.spin)}`;
}

function storedPresets(): Preset[] {
  const parsed = parsePresets(globalThis.localStorage?.getItem(STORAGE_KEY) ?? "");
  return "presets" in parsed ? parsed.presets : DEFAULT_PRESETS;
}

/** D: named shots as big buttons; queue mode strings machine presets into one multi-ball run. */
export function presetBoardVariant(): LauncherVariant {
  const state = {
    presets: storedPresets(),
    selected: 0,
    mode: "single" as Mode,
    queue: [] as Preset[],
    interval: 3,
    notice: "",
    editorOpen: false,
  };

  function mount(el: HTMLElement, onChange: () => void, assumptions: Assumptions): void {
    const refresh = () => {
      mount(el, onChange, assumptions);
      onChange();
    };
    const grid = h(
      "div",
      { class: "preset-grid" },
      ...state.presets.map((preset, index) => presetButton(preset, index, assumptions, refresh)),
    );
    el.replaceChildren(
      h(
        "div",
        { class: "preset-layout" },
        h(
          "div",
          { class: "preset-top" },
          segmented<Mode>(
            "Preset mode",
            [
              { value: "single", label: "Single shot" },
              { value: "queue", label: `Queue ≤${MAX_QUEUE}` },
            ],
            state.mode,
            (mode) => {
              state.mode = mode;
              state.notice = "";
              refresh();
            },
          ).el,
          h("span", { class: "hint" }, state.notice),
        ),
        grid,
        state.mode === "queue" ? queueStrip(refresh) : h("span"),
        presetEditor(refresh),
      ),
    );
  }

  function presetButton(preset: Preset, index: number, assumptions: Assumptions, refresh: () => void): HTMLElement {
    const queued = state.queue.filter((entry) => entry === preset).length;
    const pressed = state.mode === "single" ? index === state.selected : queued > 0;
    const button = h(
      "button",
      { type: "button", class: `preset ${preset.kind}`, "aria-pressed": pressed },
      h("strong", {}, preset.name),
      h("small", {}, presetDetail(preset, assumptions.flipDirection)),
      ...(state.mode === "queue" && queued > 0 ? [h("span", { class: "badge" }, `×${queued}`)] : []),
    );
    button.addEventListener("click", () => {
      if (state.mode === "single") state.selected = index;
      else addToQueue(preset);
      refresh();
    });
    return button;
  }

  function addToQueue(preset: Preset): void {
    const refusal = queueRefusal(state.queue, preset);
    state.notice = refusal ?? "";
    if (!refusal) state.queue.push(preset);
  }

  function queueStrip(refresh: () => void): HTMLElement {
    const chips = state.queue.map((preset, index) => {
      const chip = h(
        "button",
        { type: "button", class: "chip", "aria-label": `Remove ${preset.name}` },
        `${index + 1}. ${preset.name} ✕`,
      );
      chip.addEventListener("click", () => {
        state.queue.splice(index, 1);
        refresh();
      });
      return chip;
    });
    const clear = h("button", { type: "button", disabled: state.queue.length === 0 }, "Clear");
    clear.addEventListener("click", () => {
      state.queue = [];
      refresh();
    });
    return h(
      "div",
      { class: "queue" },
      h(
        "div",
        { class: "chips" },
        ...(chips.length ? chips : [h("span", { class: "hint" }, "Tap presets to queue them in order.")]),
        clear,
      ),
      slider({
        id: "l-interval",
        label: "Every",
        span: SPANS.interval,
        value: state.interval,
        format: (v) => `${v.toFixed(1)} s`,
        onInput: (v) => {
          state.interval = v;
        },
      }).el,
      h(
        "p",
        { class: "hint" },
        "Fires as one ball_machine run: b[] in this order, random_order:false, total_balls = queue length.",
      ),
    );
  }

  function presetEditor(refresh: () => void): HTMLElement {
    const text = h("textarea", { class: "preset-json", rows: 10, spellcheck: false, "aria-label": "Preset JSON" });
    text.value = JSON.stringify(state.presets, null, 1);
    const error = h("span", { class: "hint error" });
    const apply = h("button", { type: "button" }, "Apply");
    apply.addEventListener("click", () => {
      const parsed = parsePresets(text.value);
      if ("error" in parsed) return void (error.textContent = parsed.error);
      replacePresets(parsed.presets, JSON.stringify(parsed.presets));
      refresh();
    });
    const reset = h("button", { type: "button" }, "Reset to defaults");
    reset.addEventListener("click", () => {
      replacePresets(DEFAULT_PRESETS, null);
      refresh();
    });
    const editor = h(
      "details",
      { class: "preset-editor", open: state.editorOpen },
      h("summary", {}, "Edit presets (JSON)"),
      text,
      h("div", { class: "row" }, apply, reset, error),
      h("p", { class: "hint" }, "Space types here instead of stopping: use the STOP button while editing."),
    );
    editor.addEventListener("toggle", () => (state.editorOpen = editor.open));
    return editor;
  }

  function replacePresets(presets: Preset[], stored: string | null): void {
    state.presets = presets;
    state.selected = 0;
    state.queue = [];
    if (stored === null) globalThis.localStorage?.removeItem(STORAGE_KEY);
    else globalThis.localStorage?.setItem(STORAGE_KEY, stored);
  }

  return {
    id: "d",
    name: "Presets",
    mount,
    current(): FireMessage | null {
      if (state.mode === "queue") return queueMessage(state.queue, state.interval);
      const preset = state.presets[state.selected];
      return preset ? presetMessage(preset) : null;
    },
  };
}
