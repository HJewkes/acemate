/** What the app knows about the current run: the set_mode mode and when it started, in phone ms. */
export interface RunInfo {
  mode: string | null;
  startedAt: number | null;
}

export const NO_RUN: RunInfo = { mode: null, startedAt: null };

// A robot clock further than this from the phone's is treated as unset, so the timer keeps the send time.
export const MAX_CLOCK_SKEW_MS = 60_000;
// Unix times below this are seconds (set_time sends seconds); above it, milliseconds.
const SECONDS_BEFORE = 1e11;

/** The run_start push's start_time in phone ms, or the time run_start was sent if it is missing or implausible. */
export function runStartMs(startTime: unknown, sentAt: number): number {
  if (typeof startTime !== "number" || !Number.isFinite(startTime) || startTime <= 0) return sentAt;
  const ms = startTime < SECONDS_BEFORE ? startTime * 1000 : startTime;
  return Math.abs(ms - sentAt) <= MAX_CLOCK_SKEW_MS ? ms : sentAt;
}

/** mm:ss, never negative; minutes keep counting past 59. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

const MODE_LABELS: Record<string, string> = { ball_machine: "Ball machine", drill: "Drill" };

export function modeLabel(mode: string | null): string {
  if (!mode) return "Starting";
  return MODE_LABELS[mode] ?? mode.replace(/_/g, " ");
}

export interface RunChipState {
  runActive: boolean;
  inFlight: boolean;
  run: RunInfo;
  now: number;
}

export interface RunChipView {
  mode: string;
  /** "--:--" until run_start has gone out. */
  elapsed: string;
}

/** The run chip is shown only while a run is active or its set_mode is in flight; null hides it. */
export function runChip({ runActive, inFlight, run, now }: RunChipState): RunChipView | null {
  if (!runActive && !inFlight) return null;
  return { mode: modeLabel(run.mode), elapsed: run.startedAt === null ? "--:--" : formatElapsed(now - run.startedAt) };
}
