import type { Motion } from "./protocol.js";

export type KeyAction = { kind: "motion"; motion: Motion } | { kind: "quit" } | { kind: "ignore" };

const KEYMAP: Record<string, Motion> = {
  w: "go_front",
  s: "go_back",
  a: "go_left",
  d: "go_right",
  q: "turn_left",
  e: "turn_right",
  " ": "stop",
  "\u001b[A": "go_front",
  "\u001b[B": "go_back",
  "\u001b[D": "turn_left",
  "\u001b[C": "turn_right",
};

export function keyAction(key: string): KeyAction {
  if (key === "\u0003" || key === "x") return { kind: "quit" };
  const motion = KEYMAP[key.length === 1 ? key.toLowerCase() : key];
  return motion ? { kind: "motion", motion } : { kind: "ignore" };
}

export const KEY_HELP = "W/S fwd/back · A/D strafe · Q/E or ←/→ turn · space stop · x or Ctrl-C quit";
