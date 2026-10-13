import type { Motion } from "./protocol.js";

// Terminals report key-repeat, never key-up, so release is inferred from repeat going quiet.
export interface HoldConfig {
  resendMs: number;
  initialHoldMs: number;
  repeatHoldMs: number;
  repeatGapMs: number;
}

export interface HoldState {
  motion: Motion | null;
  lastPressAt: number;
  repeating: boolean;
  lastSent: Motion | null;
  lastSentAt: number;
}

export const DEFAULT_HOLD: HoldConfig = { resendMs: 200, initialHoldMs: 300, repeatHoldMs: 90, repeatGapMs: 100 };

export const initialHold = (): HoldState => ({
  motion: null,
  lastPressAt: 0,
  repeating: false,
  lastSent: "stop",
  lastSentAt: 0,
});

export function press(state: HoldState, motion: Motion, now: number, config: HoldConfig): HoldState {
  if (motion === "stop") return { ...state, motion: null, repeating: false, lastSent: null };
  const repeating = motion === state.motion && now - state.lastPressAt < config.repeatGapMs;
  return { ...state, motion, lastPressAt: now, repeating };
}

export function tick(state: HoldState, now: number, config: HoldConfig): { state: HoldState; send: Motion | null } {
  const window = state.repeating ? config.repeatHoldMs : config.initialHoldMs;
  const held = state.motion !== null && now - state.lastPressAt <= window;
  const want: Motion = held && state.motion ? state.motion : "stop";
  const changed = want !== state.lastSent;
  const due = want !== "stop" && now - state.lastSentAt >= config.resendMs;
  if (!changed && !due) return { state, send: null };
  const motion = held ? state.motion : null;
  return { state: { ...state, motion, lastSent: want, lastSentAt: now }, send: want };
}
