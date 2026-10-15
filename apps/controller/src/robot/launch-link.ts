import { NO_RUN, runStartMs, type RunInfo } from "../launcher/run-chip";
import { LaunchController, type LaunchMessage, type Request } from "@acemate/core";

export type CarState = { running?: boolean; bat?: number | null; time_is_set?: boolean } & Record<string, unknown>;

export interface LaunchListener {
  report(text: string): void;
  carState(state: CarState): void;
}

export interface LaunchLinkDeps {
  send(request: Request): Promise<void>;
  driveStopped(): boolean;
  now(): number;
}

// The stock app resends set_time whenever the heartbeat says the clock is unset; we throttle it to 30 s.
export const SET_TIME_EVERY_MS = 30_000;

export function setTimeRequest(now: number): Request {
  return {
    type: "set_time",
    data: {
      unix_timestamp: Math.floor(now / 1000),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
      country_code: "US",
    },
  };
}

type Waiter = { type: string; resolve: (message: Request | null) => void };

/** Robot-side launch plumbing around the shared LaunchController: replies, heartbeat run tracking and the clock. */
export class LaunchLink {
  private readonly controller: LaunchController;
  private readonly waiters = new Set<Waiter>();
  private readonly listeners = new Set<LaunchListener>();
  private timeSentAt: number | null = null;
  private runInfo: RunInfo = NO_RUN;

  constructor(private readonly deps: LaunchLinkDeps) {
    this.controller = new LaunchController({
      send: (request) => (this.noteSent(request), deps.send(request)),
      waitFor: (type, timeoutMs) => this.waitFor(type, timeoutMs),
      driveStopped: deps.driveStopped,
      report: (text) => this.report(text),
      now: deps.now,
    });
  }

  /** True from rsp_set_mode until a run_stop push or the heartbeat shows the run ended, or it is stopped. */
  get running(): boolean {
    return this.controller.running;
  }

  /** True while a fire waits for its set_mode reply, before the run counts as active. */
  get inFlight(): boolean {
    return this.controller.inFlight;
  }

  /** A run is active or a set_mode is in flight, so closing the link needs a run_stop first. */
  get mayBeRunning(): boolean {
    return this.controller.mayBeRunning;
  }

  /** The latest run's mode and start, kept after it ends; reset by the next set_mode. */
  get run(): RunInfo {
    return this.runInfo;
  }

  listen(listener: LaunchListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Never rejects: a failed write is reported, and the controller's own checks report refusals. */
  async handle(message: LaunchMessage): Promise<void> {
    try {
      await this.controller.handle(message);
    } catch (error) {
      this.report(`${message.kind} failed: ${(error as Error).message}`);
    }
  }

  onMessage(message: { type: string; data?: unknown }): void {
    for (const waiter of this.waiters) if (waiter.type === message.type) waiter.resolve(message as Request);
    if (message.type === "run_start") this.onRunStart(pushFields(message));
    if (message.type === "run_stop") this.onRunStop(pushFields(message));
    const carState = (message.data as { car_state?: CarState } | undefined)?.car_state;
    if (message.type === "rsp_heartbeat" && carState) this.onCarState(carState);
  }

  private onCarState(carState: CarState): void {
    const now = this.deps.now();
    if (carState.time_is_set === false && (this.timeSentAt === null || now - this.timeSentAt >= SET_TIME_EVERY_MS)) {
      this.timeSentAt = now;
      this.deps.send(setTimeRequest(now)).catch(() => undefined);
    }
    this.controller.onCarState(carState.running === true, now);
    this.listeners.forEach((listener) => listener.carState(carState));
  }

  private noteSent(request: Request): void {
    const mode = (request.data as { mode?: unknown } | undefined)?.mode;
    if (request.type === "set_mode") this.runInfo = { mode: typeof mode === "string" ? mode : null, startedAt: null };
    if (request.type === "run_start") this.runInfo = { ...this.runInfo, startedAt: this.deps.now() };
  }

  // The robot's own start time beats our send time; its mode confirms the set_mode one.
  private onRunStart(fields: Record<string, unknown>): void {
    this.controller.onRunStart(fields.start_time);
    const sentAt = this.runInfo.startedAt ?? this.deps.now();
    const mode = typeof fields.mode === "string" ? fields.mode : this.runInfo.mode;
    this.runInfo = { mode, startedAt: runStartMs(fields.start_time, sentAt) };
  }

  private onRunStop(fields: Record<string, unknown>): void {
    this.controller.onRunStop(fields.reason, fields.end_time);
  }

  private report(text: string): void {
    this.listeners.forEach((listener) => listener.report(text));
  }

  private waitFor(type: string, timeoutMs: number): Promise<Request | null> {
    return new Promise((resolve) => {
      const waiter: Waiter = {
        type,
        resolve: (message) => {
          this.waiters.delete(waiter);
          clearTimeout(timer);
          resolve(message);
        },
      };
      const timer = setTimeout(() => waiter.resolve(null), timeoutMs);
      this.waiters.add(waiter);
    });
  }
}

// Pushes have been seen as {type, mode, start_time}; accept the fields under data too.
function pushFields(message: { data?: unknown }): Record<string, unknown> {
  const { data } = message;
  return data && typeof data === "object" ? { ...message, ...(data as Record<string, unknown>) } : { ...message };
}
