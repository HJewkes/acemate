/** How long Fire must be held before it sends. */
export const HOLD_MS = 1200;

export interface HoldReading {
  fire: boolean;
  /** 0 when idle, up to 1 when the hold completes. */
  progress: number;
}

export interface HoldFire {
  press(now: number): HoldReading;
  release(): HoldReading;
  cancel(): HoldReading;
  tick(now: number): HoldReading;
}

type Phase = { kind: "idle" } | { kind: "holding"; since: number } | { kind: "spent" };

/** Hold-to-fire: fires once after holdMs of continuous hold, then stays spent until released. */
export function createHoldFire(holdMs: number = HOLD_MS): HoldFire {
  let phase: Phase = { kind: "idle" };
  const idle = (): HoldReading => {
    phase = { kind: "idle" };
    return { fire: false, progress: 0 };
  };
  const tick = (now: number): HoldReading => {
    if (phase.kind === "idle") return { fire: false, progress: 0 };
    if (phase.kind === "spent") return { fire: false, progress: 1 };
    const progress = Math.min(1, Math.max(0, (now - phase.since) / holdMs));
    if (progress < 1) return { fire: false, progress };
    phase = { kind: "spent" };
    return { fire: true, progress: 1 };
  };
  return {
    press(now) {
      if (phase.kind === "idle") phase = { kind: "holding", since: now };
      return tick(now);
    },
    release: idle,
    cancel: idle,
    tick,
  };
}
